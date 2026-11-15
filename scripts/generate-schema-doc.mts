// Writes docs/schema.md: one entity-relationship diagram per domain plus a table index, read from a migrated database
// so the diagrams cannot drift from the real schema the way a hand-drawn one can.
//
//   DATABASE_URL=postgresql://…/a_migrated_test_database npm run docs:schema
//
// It only reads the catalogue (information_schema and pg_constraint); it writes nothing to the database.
import pg from 'pg';
import { writeFileSync } from 'node:fs';

// Every table belongs to exactly one domain. A table that is not listed lands under "Other" and the script says so,
// which is the cue to add it here when a migration creates one.
const DOMAINS: Array<{ title: string; blurb: string; tables: string[] }> = [
  {
    title: 'Identity and access',
    blurb: 'Who can sign in, as what, and how their sessions and consents are recorded.',
    tables: ['users', 'customers', 'sellers', 'riders', 'admins', 'auth_sessions', 'oauth_identities', 'password_reset_tokens', 'customer_policy_consents'],
  },
  {
    title: 'Catalogue and discovery',
    blurb: 'What can be bought, what customers keep for later and what they say about it.',
    tables: ['categories', 'products', 'seller_bundles', 'cart', 'customer_wishlist', 'reviews', 'product_analytics_events'],
  },
  {
    title: 'Orders and payments',
    blurb: 'From a checkout to a paid, refunded or cancelled order, with the nightly reconciliation that checks it against the gateway.',
    tables: [
      'orders', 'order_items', 'checkout_idempotency', 'payments', 'refunds', 'order_cancellation_requests',
      'order_status_audit', 'payment_reconciliation_runs', 'payment_reconciliation_findings',
    ],
  },
  {
    title: 'Fulfilment and delivery',
    blurb: 'An order is split per seller; each part is shipped and delivered by a rider.',
    tables: ['seller_fulfillments', 'rider_deliveries', 'rider_reviews', 'rider_monthly_scores'],
  },
  {
    title: 'Wallets and payouts',
    blurb: 'Append-only ledger entries for what sellers and riders earn, and the payouts and withdrawals that settle them.',
    tables: ['seller_wallet_entries', 'seller_payouts', 'rider_wallet_entries', 'rider_withdrawals'],
  },
  {
    title: 'Verification, support and operations',
    blurb: 'Documents and review trails for approving sellers and riders, customer support, and the migration history.',
    tables: [
      'seller_documents', 'seller_verification_documents', 'rider_verification_documents', 'application_review_audit',
      'seller_status_audit', 'support_requests', 'schema_migrations',
    ],
  },
];

const TYPES: Record<string, string> = {
  'character varying': 'varchar',
  character: 'char',
  'timestamp with time zone': 'timestamptz',
  'timestamp without time zone': 'timestamp',
  'double precision': 'float8',
  ARRAY: 'array',
  'USER-DEFINED': 'enum',
};

type Column = { name: string; type: string; nullable: boolean };
type ForeignKey = { table: string; column: string; refTable: string; refColumn: string; nullable: boolean; unique: boolean };

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Set DATABASE_URL to a migrated database.');
const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const columnRows = await client.query<{ table_name: string; column_name: string; data_type: string; is_nullable: string }>(
    `SELECT c.table_name, c.column_name, c.data_type, c.is_nullable
       FROM information_schema.columns c
       JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY c.table_name, c.ordinal_position`
  );
  const columns = new Map<string, Column[]>();
  for (const row of columnRows.rows) {
    const list = columns.get(row.table_name) ?? [];
    list.push({ name: row.column_name, type: TYPES[row.data_type] ?? row.data_type.replace(/\s+/g, '_'), nullable: row.is_nullable === 'YES' });
    columns.set(row.table_name, list);
  }

  const keyRows = await client.query<{ table_name: string; kind: string; cols: string[] }>(
    `SELECT rel.relname AS table_name, con.contype AS kind,
            ARRAY(SELECT att.attname::text FROM unnest(con.conkey) WITH ORDINALITY k(attnum, ord)
                    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum ORDER BY k.ord)::text[] AS cols
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      WHERE ns.nspname = 'public' AND con.contype IN ('p', 'u')`
  );
  const primary = new Map<string, Set<string>>();
  const unique = new Map<string, Set<string>>(); // columns that are the only column of a unique constraint
  for (const row of keyRows.rows) {
    if (row.kind === 'p') primary.set(row.table_name, new Set(row.cols));
    if (row.kind === 'u' && row.cols.length === 1) {
      const set = unique.get(row.table_name) ?? new Set<string>();
      set.add(row.cols[0]);
      unique.set(row.table_name, set);
    }
  }

  const fkRows = await client.query<{ table_name: string; column_name: string; ref_table: string; ref_column: string }>(
    `SELECT rel.relname AS table_name, att.attname AS column_name, frel.relname AS ref_table, fatt.attname AS ref_column
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       JOIN pg_class frel ON frel.oid = con.confrelid
       JOIN pg_namespace ns ON ns.oid = rel.relnamespace
       JOIN LATERAL unnest(con.conkey, con.confkey) AS k(attnum, fattnum) ON true
       JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
       JOIN pg_attribute fatt ON fatt.attrelid = con.confrelid AND fatt.attnum = k.fattnum
      WHERE ns.nspname = 'public' AND con.contype = 'f'
      ORDER BY rel.relname, att.attname`
  );
  const foreignKeys: ForeignKey[] = fkRows.rows.map((row) => {
    const column = columns.get(row.table_name)?.find((candidate) => candidate.name === row.column_name);
    const soleUnique = unique.has(row.table_name) && unique.get(row.table_name)!.has(row.column_name);
    const solePrimary = primary.get(row.table_name)?.size === 1 && primary.get(row.table_name)!.has(row.column_name);
    return {
      table: row.table_name, column: row.column_name, refTable: row.ref_table, refColumn: row.ref_column,
      nullable: column?.nullable ?? false, unique: soleUnique || solePrimary,
    };
  });

  const known = new Set(DOMAINS.flatMap((domain) => domain.tables));
  const other = [...columns.keys()].filter((table) => !known.has(table)).sort();
  const missing = [...known].filter((table) => !columns.has(table));
  if (missing.length) console.warn(`Listed in a domain but not in the database: ${missing.join(', ')}`);
  const domains = other.length ? [...DOMAINS, { title: 'Other', blurb: 'Tables not yet assigned to a domain in scripts/generate-schema-doc.mts.', tables: other }] : DOMAINS;
  if (other.length) console.warn(`Not assigned to a domain (listed under "Other"): ${other.join(', ')}`);

  const entity = (name: string) => name;
  const lines: string[] = [];
  lines.push('# Database schema');
  lines.push('');
  lines.push('> Generated by `npm run docs:schema` from the migrated PostgreSQL schema; do not edit by hand. Re-run it after adding a migration.');
  lines.push('> For the reasoning behind the design see [database-design.md](database-design.md); for a one-page overview see [erd.md](erd.md).');
  lines.push('');
  lines.push(`${columns.size} tables and ${foreignKeys.length} foreign keys, grouped into ${domains.length} domains. In each diagram a table that belongs to another domain appears as an empty box, so you can see where the groups connect.`);
  lines.push('');
  lines.push('Read the relationship lines like this: `||--o{` is "one to many", `|o--o{` is "optional one to many" (the foreign key may be empty), and `||--o|` is "one to at most one". `PK` marks a primary key, `FK` a foreign key and `UK` a column that is unique on its own. Not every reference between tables is a foreign key; where a column points at rows in more than one table (for example `seller_wallet_entries.reference_id`, which names a fulfilment or a payout depending on the entry type) no line is drawn.');
  lines.push('');
  lines.push('| Domain | Tables |');
  lines.push('| --- | --- |');
  for (const domain of domains) lines.push(`| [${domain.title}](#${domain.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}) | ${domain.tables.filter((t) => columns.has(t)).map((t) => `\`${t}\``).join(', ')} |`);
  lines.push('');

  for (const domain of domains) {
    const inDomain = new Set(domain.tables.filter((table) => columns.has(table)));
    lines.push(`## ${domain.title}`);
    lines.push('');
    lines.push(domain.blurb);
    lines.push('');
    lines.push('```mermaid');
    lines.push('erDiagram');
    const relations = foreignKeys.filter((fk) => inDomain.has(fk.table) || inDomain.has(fk.refTable));
    const seen = new Set<string>();
    for (const fk of relations) {
      // Self-references and the other domain's tables are drawn as plain relationship lines.
      const left = fk.unique ? '||' : fk.nullable ? '|o' : '||';
      const right = fk.unique ? 'o|' : 'o{';
      const line = `    ${entity(fk.refTable)} ${left}--${right} ${entity(fk.table)} : "${fk.column}"`;
      if (!seen.has(line)) { seen.add(line); lines.push(line); }
    }
    for (const table of [...inDomain].sort()) {
      lines.push(`    ${entity(table)} {`);
      const fkColumns = new Set(foreignKeys.filter((fk) => fk.table === table).map((fk) => fk.column));
      for (const column of columns.get(table) ?? []) {
        const marks: string[] = [];
        if (primary.get(table)?.has(column.name)) marks.push('PK');
        if (fkColumns.has(column.name)) marks.push('FK');
        if (unique.get(table)?.has(column.name) && !marks.includes('PK')) marks.push('UK');
        lines.push(`        ${column.type} ${column.name}${marks.length ? ' ' + marks.join(',') : ''}`);
      }
      lines.push('    }');
    }
    lines.push('```');
    lines.push('');
  }

  writeFileSync('docs/schema.md', lines.join('\n').replace(/\n+$/, '\n'));
  console.log(`Wrote docs/schema.md (${columns.size} tables, ${foreignKeys.length} foreign keys).`);
} finally {
  await client.end();
}
