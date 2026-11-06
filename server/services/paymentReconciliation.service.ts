import { pool, query } from '../db/index.ts';
import {
  GatewayError,
  sslcommerz,
  type SSLCommerzRefundResult,
  type SSLCommerzTransactionQueryResult,
} from './sslcommerz.service.ts';
import { toPaisa } from '../../src/lib/checkoutPricing.ts';

type PaymentRecord = {
  id: string;
  order_id: string | null;
  amount: string | number;
  currency: string;
  status: string;
  transaction_id: string;
};

type FindingIdentity = {
  paymentId?: string | null;
  orderId?: string | null;
  refundId?: string | null;
};

type FindingInput = FindingIdentity & {
  kind: string;
  severity: 'high' | 'medium' | 'low';
  detail: Record<string, string | number | string[] | null>;
};

export interface ReconciliationGateway {
  queryTransactionByTranId(tranId: string): Promise<SSLCommerzTransactionQueryResult>;
  getRefundStatus(refundRefId: string): Promise<SSLCommerzRefundResult>;
}

export interface PaymentReconciliationOptions {
  gateway?: ReconciliationGateway;
  autoRepair?: boolean;
  now?: Date;
  finalizePayment?: (tranId: string, valId: string) => Promise<unknown>;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface PaymentReconciliationSummary {
  runId: string;
  status: 'ok' | 'partial' | 'failed';
  checked: number;
  matched: number;
  repaired: number;
  findingsOpened: number;
  highSeverityOpen: number;
}

/** Raised when another reconciliation run is in progress, so the endpoint can answer 409 instead of running twice. */
export class ReconciliationBusyError extends Error {
  constructor() {
    super('Payment reconciliation is already running.');
    this.name = 'ReconciliationBusyError';
  }
}

// A run that never finished (the process died) stops blocking new runs after this long.
const RUN_STALE_AFTER_MINUTES = 30;
const RECONCILIATION_LOCK_CLASS = 1_572_902_391;
const RECONCILIATION_LOCK_ID = 901;

/**
 * Creates the run row, refusing when another run is still in progress. The lock is transaction-scoped and only
 * held while the row is created, so it behaves the same through a transaction pooler; the unfinished run row is
 * what keeps other runs out for the rest of the run.
 */
const startRun = async (windowFrom: Date, windowTo: Date): Promise<string> => {
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query('BEGIN');
    const lock = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_xact_lock($1, $2) AS locked',
      [RECONCILIATION_LOCK_CLASS, RECONCILIATION_LOCK_ID]
    );
    if (lock.rows[0]?.locked !== true) throw new ReconciliationBusyError();
    const running = await client.query(
      `SELECT 1 FROM payment_reconciliation_runs
       WHERE finished_at IS NULL AND started_at > current_timestamp - make_interval(mins => $1)
       LIMIT 1`,
      [RUN_STALE_AFTER_MINUTES]
    );
    if (running.rows.length > 0) throw new ReconciliationBusyError();
    const inserted = await client.query<{ id: string }>(
      'INSERT INTO payment_reconciliation_runs (window_from, window_to) VALUES ($1, $2) RETURNING id',
      [windowFrom, windowTo]
    );
    const id = inserted.rows[0]?.id;
    if (!id) throw new Error('Could not create reconciliation run.');
    await client.query('COMMIT');
    return id;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { discard = true; }
    throw error;
  } finally {
    client.release(discard);
  }
};

const failureReason = (error: unknown): string => {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error';
  return `Payment reconciliation failed before all checks completed (${text})`.slice(0, 500);
};

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const integerEnv = (name: string, fallback: number, min: number, max: number): number => {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};

const matchingCurrency = (first: string, second: string): boolean =>
  first.trim().toUpperCase() === second.trim().toUpperCase();

const transactionIsPaid = (status: string): boolean =>
  status === 'VALID' || status === 'VALIDATED';

const isGatewayError = (error: unknown): error is GatewayError =>
  error instanceof GatewayError;

const recordFinding = async (runId: string, finding: FindingInput): Promise<boolean> => {
  const result = await query<{ inserted: boolean }>(`
    WITH acknowledged AS (
      UPDATE payment_reconciliation_findings
      SET last_seen_at = current_timestamp, run_id = $1, detail = $6::jsonb
      WHERE status = 'acknowledged' AND kind = $2
        AND payment_id IS NOT DISTINCT FROM $3
        AND order_id IS NOT DISTINCT FROM $4
        AND refund_id IS NOT DISTINCT FROM $5
      RETURNING id
    ),
    upserted AS (
      INSERT INTO payment_reconciliation_findings (
        run_id, payment_id, order_id, refund_id, kind, severity, detail
      )
      SELECT $1, $3, $4, $5, $2, $7, $6::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM acknowledged)
      ON CONFLICT (
        kind, (coalesce(payment_id, '')), (coalesce(order_id, '')), (coalesce(refund_id, ''))
      ) WHERE status = 'open'
      DO UPDATE SET
        run_id = EXCLUDED.run_id,
        severity = EXCLUDED.severity,
        detail = EXCLUDED.detail,
        last_seen_at = current_timestamp
      RETURNING (xmax = 0) AS inserted
    )
    SELECT COALESCE((SELECT inserted FROM upserted), false) AS inserted
  `, [
    runId,
    finding.kind,
    finding.paymentId ?? null,
    finding.orderId ?? null,
    finding.refundId ?? null,
    JSON.stringify(finding.detail),
    finding.severity,
  ]);
  return result.rows[0]?.inserted === true;
};

const updateRun = async (
  runId: string,
  values: {
    checked: number;
    matched: number;
    repaired: number;
    findingsOpened: number;
    status: 'ok' | 'partial' | 'failed';
    error: string | null;
  }
) => {
  await query(`
    UPDATE payment_reconciliation_runs
    SET finished_at = current_timestamp,
        checked = $2,
        matched = $3,
        repaired = $4,
        findings_opened = $5,
        status = $6,
        error = $7
    WHERE id = $1
  `, [
    runId,
    values.checked,
    values.matched,
    values.repaired,
    values.findingsOpened,
    values.status,
    values.error,
  ]);
};

export async function runPaymentReconciliation(
  options: PaymentReconciliationOptions = {}
): Promise<PaymentReconciliationSummary> {
  const gateway = options.gateway ?? sslcommerz;
  const now = options.now ?? new Date();
  const windowDays = integerEnv('RECONCILE_WINDOW_DAYS', 3, 1, 30);
  const minAgeMinutes = integerEnv('RECONCILE_MIN_AGE_MINUTES', 45, 1, 1440);
  const maxPayments = integerEnv('RECONCILE_MAX_PAYMENTS', 500, 1, 5000);
  const autoRepair = options.autoRepair ?? process.env.RECONCILE_AUTO_REPAIR === 'true';
  const windowFrom = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const paymentWindowTo = new Date(now.getTime() - minAgeMinutes * 60 * 1000);
  const runId = await startRun(windowFrom, now);

  let checked = 0;
  let matched = 0;
  let repaired = 0;
  let findingsOpened = 0;
  let partial = false;
  let lastGatewayCallAt = 0;
  const gatewaySleep = options.sleep ?? delay;
  const callGateway = async <T>(call: () => Promise<T>): Promise<T> => {
    const wait = Math.max(0, 200 - (Date.now() - lastGatewayCallAt));
    if (wait) await gatewaySleep(wait);
    lastGatewayCallAt = Date.now();
    return call();
  };
  const addFinding = async (finding: FindingInput) => {
    if (await recordFinding(runId, finding)) findingsOpened += 1;
  };

  try {
    // These two checks read every paid online order and every validated payment, not only the recent window, on
    // purpose: a problem from months ago is still a problem. Revisit with a window or an index if the tables grow
    // past tens of thousands of rows.
    const paidOrders = await query<{
      order_id: string;
      subtotal: string | number;
      shipping_fee: string | number;
      payments: Array<{ id: string; amount: string | number }> | null;
    }>(`
      SELECT order_record.id AS order_id, order_record.subtotal, order_record.shipping_fee,
        json_agg(json_build_object('id', payment.id, 'amount', payment.amount)
          ORDER BY payment.id) FILTER (WHERE payment.id IS NOT NULL) AS payments
      FROM orders order_record
      LEFT JOIN payments payment
        ON payment.order_id = order_record.id AND payment.status = 'VALIDATED'
      WHERE order_record.payment_status = 'paid'
        AND order_record.payment_method IN ('online', 'bkash', 'nagad', 'rocket', 'visa_mastercard')
      GROUP BY order_record.id
    `);

    for (const order of paidOrders.rows) {
      checked += 1;
      const payments = order.payments ?? [];
      const expectedPaisa = toPaisa(order.subtotal) + toPaisa(order.shipping_fee);
      let orderMatched = true;
      if (payments.length === 0) {
        orderMatched = false;
        await addFinding({
          orderId: order.order_id,
          kind: 'paid_online_order_without_validated_payment',
          severity: 'high',
          detail: { orderId: order.order_id, orderPaymentStatus: 'paid' },
        });
      } else if (payments.length > 1) {
        orderMatched = false;
        await addFinding({
          orderId: order.order_id,
          kind: 'paid_online_order_multiple_validated_payments',
          severity: 'high',
          detail: { orderId: order.order_id, orderPaymentStatus: 'paid', paymentIds: payments.map((payment) => payment.id) },
        });
      } else {
        const payment = payments[0];
        const paymentPaisa = toPaisa(payment.amount);
        if (paymentPaisa !== expectedPaisa) {
          orderMatched = false;
          await addFinding({
            paymentId: payment.id,
            orderId: order.order_id,
            kind: 'paid_online_order_amount_mismatch',
            severity: 'high',
            detail: {
              orderId: order.order_id,
              paymentId: payment.id,
              expectedAmountPaisa: expectedPaisa,
              paymentAmountPaisa: paymentPaisa,
            },
          });
        }
      }
      if (orderMatched) matched += 1;
    }

    const validatedPayments = await query<{
      id: string;
      order_id: string | null;
      amount: string | number;
      order_payment_status: string | null;
      order_exists: boolean;
    }>(`
      SELECT payment.id, payment.order_id, payment.amount,
        order_record.payment_status AS order_payment_status,
        (order_record.id IS NOT NULL) AS order_exists
      FROM payments payment
      LEFT JOIN orders order_record ON order_record.id = payment.order_id
      WHERE payment.status = 'VALIDATED'
    `);

    for (const payment of validatedPayments.rows) {
      checked += 1;
      if (!payment.order_id) {
        await addFinding({
          paymentId: payment.id,
          kind: 'validated_payment_without_order_id',
          severity: 'medium',
          detail: { paymentId: payment.id, paymentStatus: 'VALIDATED', paymentAmountPaisa: toPaisa(payment.amount) },
        });
      } else if (!payment.order_exists) {
        await addFinding({
          paymentId: payment.id,
          kind: 'validated_payment_order_missing',
          severity: 'high',
          detail: { paymentId: payment.id, orderId: payment.order_id, paymentStatus: 'VALIDATED', paymentAmountPaisa: toPaisa(payment.amount) },
        });
      } else if (payment.order_payment_status !== 'paid') {
        await addFinding({
          paymentId: payment.id,
          orderId: payment.order_id,
          kind: 'validated_payment_order_not_paid',
          severity: 'high',
          detail: {
            paymentId: payment.id,
            orderId: payment.order_id,
            paymentStatus: 'VALIDATED',
            orderPaymentStatus: payment.order_payment_status,
            paymentAmountPaisa: toPaisa(payment.amount),
          },
        });
      } else {
        matched += 1;
      }
    }

    const candidateResult = await query<PaymentRecord>(`
      SELECT id, order_id, amount, currency, status, transaction_id
      FROM payments
      WHERE gateway = 'sslcommerz'
        AND status IN ('PENDING', 'EXPIRED', 'VALIDATED')
        AND created_at >= $1 AND created_at < $2
      ORDER BY created_at ASC, id ASC
      LIMIT $3
    `, [windowFrom, paymentWindowTo, maxPayments]);

    for (const payment of candidateResult.rows) {
      checked += 1;
      let transaction: SSLCommerzTransactionQueryResult;
      try {
        transaction = await callGateway(() => gateway.queryTransactionByTranId(payment.transaction_id));
      } catch (error) {
        if (!isGatewayError(error)) throw error;
        partial = true;
        continue;
      }

      const transactionStatus = transaction.status.toUpperCase();
      const hasGatewayRecord = transactionStatus !== 'NOT_FOUND';
      const gatewayPaid = transactionIsPaid(transactionStatus);
      if (!hasGatewayRecord) {
        if (payment.status === 'VALIDATED') {
          await addFinding({
            paymentId: payment.id,
            orderId: payment.order_id,
            kind: 'validated_payment_missing_at_gateway',
            severity: 'high',
            detail: {
              paymentId: payment.id,
              orderId: payment.order_id,
              paymentStatus: payment.status,
              gatewayStatus: transactionStatus,
              paymentAmountPaisa: toPaisa(payment.amount),
            },
          });
        } else {
          matched += 1;
        }
        continue;
      }

      if (
        transaction.amount === null
        || transaction.currency === null
        || !transaction.tran_id
        || transaction.tran_id !== payment.transaction_id
      ) {
        partial = true;
        continue;
      }

      const paymentPaisa = toPaisa(payment.amount);
      const gatewayPaisa = toPaisa(transaction.amount);
      const amountMatches = paymentPaisa === gatewayPaisa;
      const currencyMatches = matchingCurrency(payment.currency, transaction.currency);
      if (!amountMatches) {
        await addFinding({
          paymentId: payment.id,
          orderId: payment.order_id,
          kind: 'gateway_payment_amount_mismatch',
          severity: 'high',
          detail: {
            paymentId: payment.id,
            orderId: payment.order_id,
            paymentStatus: payment.status,
            gatewayStatus: transactionStatus,
            paymentAmountPaisa: paymentPaisa,
            gatewayAmountPaisa: gatewayPaisa,
          },
        });
        continue;
      }
      if (!currencyMatches) {
        await addFinding({
          paymentId: payment.id,
          orderId: payment.order_id,
          kind: 'gateway_payment_currency_mismatch',
          severity: 'high',
          detail: {
            paymentId: payment.id,
            orderId: payment.order_id,
            paymentStatus: payment.status,
            gatewayStatus: transactionStatus,
            paymentAmountPaisa: paymentPaisa,
            gatewayAmountPaisa: gatewayPaisa,
          },
        });
        continue;
      }

      if (payment.status === 'VALIDATED') {
        if (!gatewayPaid) {
          await addFinding({
            paymentId: payment.id,
            orderId: payment.order_id,
            kind: 'validated_payment_gateway_status_mismatch',
            severity: 'high',
            detail: {
              paymentId: payment.id,
              orderId: payment.order_id,
              paymentStatus: payment.status,
              gatewayStatus: transactionStatus,
              paymentAmountPaisa: paymentPaisa,
              gatewayAmountPaisa: gatewayPaisa,
            },
          });
        } else {
          matched += 1;
        }
        continue;
      }

      if (!gatewayPaid) {
        matched += 1;
        continue;
      }

      if (!autoRepair) {
        await addFinding({
          paymentId: payment.id,
          orderId: payment.order_id,
          kind: 'paid_at_gateway_not_here',
          severity: 'high',
          detail: {
            paymentId: payment.id,
            orderId: payment.order_id,
            paymentStatus: payment.status,
            gatewayStatus: transactionStatus,
            paymentAmountPaisa: paymentPaisa,
            gatewayAmountPaisa: gatewayPaisa,
          },
        });
        continue;
      }

      if (!transaction.val_id) {
        partial = true;
        await addFinding({
          paymentId: payment.id,
          orderId: payment.order_id,
          kind: 'paid_at_gateway_not_here',
          severity: 'high',
          detail: {
            paymentId: payment.id,
            orderId: payment.order_id,
            paymentStatus: payment.status,
            gatewayStatus: transactionStatus,
            paymentAmountPaisa: paymentPaisa,
            gatewayAmountPaisa: gatewayPaisa,
          },
        });
        continue;
      }

      try {
        if (options.finalizePayment) {
          await options.finalizePayment(payment.transaction_id, transaction.val_id);
        } else {
          throw new GatewayError('Payment finalization is not configured.');
        }
        repaired += 1;
      } catch {
        partial = true;
        await addFinding({
          paymentId: payment.id,
          orderId: payment.order_id,
          kind: 'paid_at_gateway_not_here',
          severity: 'high',
          detail: {
            paymentId: payment.id,
            orderId: payment.order_id,
            paymentStatus: payment.status,
            gatewayStatus: transactionStatus,
            paymentAmountPaisa: paymentPaisa,
            gatewayAmountPaisa: gatewayPaisa,
          },
        });
      }
    }

    const refundResult = await query<{
      id: string;
      order_id: string;
      payment_id: string | null;
      amount: string | number;
      status: string;
      gateway_ref: string | null;
    }>(`
      SELECT id, order_id, payment_id, amount, status, gateway_ref
      FROM refunds
      WHERE method = 'sslcommerz'
        AND (
          status = 'completed'
          OR (status IN ('initiating', 'submitted')
            AND created_at < $1::timestamptz - INTERVAL '24 hours')
        )
      ORDER BY created_at ASC, id ASC
    `, [now]);

    for (const refund of refundResult.rows) {
      checked += 1;
      const refundAmountPaisa = toPaisa(refund.amount);
      const stuck = refund.status === 'initiating' || refund.status === 'submitted';
      if (stuck) {
        await addFinding({
          paymentId: refund.payment_id,
          orderId: refund.order_id,
          refundId: refund.id,
          kind: 'refund_stuck',
          severity: 'medium',
          detail: {
            refundId: refund.id,
            orderId: refund.order_id,
            paymentId: refund.payment_id,
            refundStatus: refund.status,
            refundAmountPaisa,
          },
        });
      }
      if (!refund.gateway_ref) {
        if (!stuck) {
          await addFinding({
            paymentId: refund.payment_id,
            orderId: refund.order_id,
            refundId: refund.id,
            kind: 'completed_refund_missing_at_gateway',
            severity: 'high',
            detail: {
              refundId: refund.id,
              orderId: refund.order_id,
              paymentId: refund.payment_id,
              refundStatus: refund.status,
              refundAmountPaisa,
            },
          });
        }
        continue;
      }

      try {
        const gatewayRefund = await callGateway(() => gateway.getRefundStatus(refund.gateway_ref!));
        const gatewayStatus = String(gatewayRefund.status ?? 'unknown').toLowerCase();
        if (stuck) {
          continue;
        } else if (gatewayStatus !== 'refunded') {
          await addFinding({
            paymentId: refund.payment_id,
            orderId: refund.order_id,
            refundId: refund.id,
            kind: 'completed_refund_missing_at_gateway',
            severity: 'high',
            detail: {
              refundId: refund.id,
              orderId: refund.order_id,
              paymentId: refund.payment_id,
              refundStatus: refund.status,
              gatewayStatus,
              refundAmountPaisa,
            },
          });
        } else {
          matched += 1;
        }
      } catch (error) {
        if (!isGatewayError(error)) throw error;
        partial = true;
      }
    }

    const status = partial ? 'partial' : 'ok';
    await updateRun(runId, {
      checked,
      matched,
      repaired,
      findingsOpened,
      status,
      error: partial ? 'One or more gateway checks or repairs failed.' : null,
    });
  } catch (error) {
    const reason = failureReason(error);
    console.error(reason);
    await updateRun(runId, {
      checked,
      matched,
      repaired,
      findingsOpened,
      status: 'failed',
      error: reason,
    });
  }

  const finalRun = await query<{
    status: 'ok' | 'partial' | 'failed';
    checked: number;
    matched: number;
    repaired: number;
    findings_opened: number;
  }>('SELECT status, checked, matched, repaired, findings_opened FROM payment_reconciliation_runs WHERE id = $1', [runId]);
  const highOpen = await query<{ count: string }>(
    "SELECT count(*)::text AS count FROM payment_reconciliation_findings WHERE status = 'open' AND severity = 'high'"
  );
  const row = finalRun.rows[0];
  if (!row) throw new Error('Reconciliation run disappeared before completion.');
  return {
    runId,
    status: row.status,
    checked: Number(row.checked),
    matched: Number(row.matched),
    repaired: Number(row.repaired),
    findingsOpened: Number(row.findings_opened),
    highSeverityOpen: Number(highOpen.rows[0]?.count || 0),
  };
}
