import React from 'react';
import { Lock } from 'lucide-react';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import { useLocale } from '../../lib/i18n';
import { MyTransactions } from '../../types';

const METHOD_NAMES: Record<string, string> = {
  cash_on_delivery: 'Cash on delivery', cod: 'Cash on delivery', visa_mastercard: 'Card', bkash: 'bKash', nagad: 'Nagad', sslcommerz: 'SSLCommerz',
};
const METHOD_LABEL = (method: string) => METHOD_NAMES[method.toLowerCase()] ?? method.replaceAll('_', ' ');

/**
 * The signed-in person's own money, and nobody else's. The server only returns that person's rows, so the same page
 * serves customers (who they paid), sellers (their share and commission) and riders (their wallet).
 */
export const TransactionsPage: React.FC = () => {
  const { t, locale } = useLocale();
  const [data, setData] = React.useState<MyTransactions | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    api.getMyTransactions()
      .then((next) => { if (active) setData(next); })
      .catch((err) => { if (active) setError(err?.message || t('txLoadFailed')); });
    return () => { active = false; };
  }, []);

  const formatDate = (value: string) => new Date(value).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const typeLabel = (type: string) => type === 'salary' ? t('txSalary') : type === 'cod_collected' ? t('txCodCollected') : type.includes('withdraw') ? t('txWithdrawal') : t('txOther');

  const head = 'px-4 py-3 text-left text-xs font-semibold text-[var(--chart-axis)]';
  const cell = 'px-4 py-3 align-top text-sm text-[var(--chart-ink)]';
  const subtitle = data?.role === 'seller' ? t('txSubtitleSeller') : data?.role === 'rider' ? t('txSubtitleRider') : t('txSubtitleCustomer');

  return (
    <section aria-labelledby="transactions-title" className="space-y-5">
      <header className="min-w-0">
        <h2 id="transactions-title" className="font-display text-3xl font-normal text-[var(--chart-ink)] sm:text-4xl">{t('txTitle')}</h2>
        <p className="mt-1.5 text-base text-[var(--chart-axis)]">{subtitle}</p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--glass-edge,rgba(255,255,255,.12))] px-3 py-1 text-xs text-[var(--chart-axis)]">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />{t('txPrivate')}
        </p>
      </header>

      {error && <p role="alert" className="rounded-2xl border border-danger-300 bg-danger-50 px-4 py-3 text-sm text-danger-800 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-200">{error}</p>}
      {!data && !error && <div aria-hidden="true" className="premium-skeleton h-64 rounded-3xl" />}

      {data && data.rows.length === 0 && (
        <p className="chart-card rounded-3xl p-10 text-center text-sm text-[var(--chart-axis)]">{t('txEmpty')}</p>
      )}

      {data && data.rows.length > 0 && (
        <div className="chart-card overflow-x-auto rounded-3xl">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              {data.role === 'customer' && <tr><th className={head}>{t('txDate')}</th><th className={head}>{t('txOrder')}</th><th className={head}>{t('txMethod')}</th><th className={head}>{t('txPaidTo')}</th><th className={`${head} text-right`}>{t('txTotal')}</th></tr>}
              {data.role === 'seller' && <tr><th className={head}>{t('txDate')}</th><th className={head}>{t('txOrder')}</th><th className={head}>{t('txMethod')}</th><th className={`${head} text-right`}>{t('txGross')}</th><th className={`${head} text-right`}>{t('txCommission')}</th><th className={`${head} text-right`}>{t('txNet')}</th></tr>}
              {data.role === 'rider' && <tr><th className={head}>{t('txDate')}</th><th className={head}>{t('txType')}</th><th className={head}>{t('txOwedTo')}</th><th className={`${head} text-right`}>{t('txAmount')}</th></tr>}
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle,rgba(0,0,0,.08))]">
              {data.role === 'customer' && data.rows.map((row) => (
                <tr key={row.id}>
                  <td className={cell}>{formatDate(row.date)}</td>
                  <td className={`${cell} tabular-nums`}>#{row.id.replace(/^ORD-/, '').slice(-8)}</td>
                  <td className={cell}>{METHOD_LABEL(row.method)}<span className="block text-xs text-[var(--chart-axis)]">{row.paymentStatus}</span></td>
                  <td className={cell}>
                    <ul className="space-y-1">
                      {row.payees.map((payee, index) => (
                        <li key={`${payee.kind}-${index}`} className="flex justify-between gap-6"><span>{payee.kind === 'delivery' ? t('txDelivery') : payee.name}</span><span className="tabular-nums text-[var(--chart-axis)]">{money(payee.amount)}</span></li>
                      ))}
                    </ul>
                  </td>
                  <td className={`${cell} text-right font-semibold tabular-nums`}>{money(row.total)}</td>
                </tr>
              ))}
              {data.role === 'seller' && data.rows.map((row) => (
                <tr key={`${row.id}-${row.date}`}>
                  <td className={cell}>{formatDate(row.date)}</td>
                  <td className={`${cell} tabular-nums`}>#{row.id.replace(/^ORD-/, '').slice(-8)}</td>
                  <td className={cell}>{METHOD_LABEL(row.method)}<span className="block text-xs text-[var(--chart-axis)]">{row.paymentStatus}</span></td>
                  <td className={`${cell} text-right tabular-nums`}>{money(row.gross)}</td>
                  <td className={`${cell} text-right tabular-nums text-[var(--chart-axis)]`}>{money(row.commission)}</td>
                  <td className={`${cell} text-right font-semibold tabular-nums`}>{money(row.net)}</td>
                </tr>
              ))}
              {data.role === 'rider' && data.rows.map((row) => (
                <tr key={row.id}>
                  <td className={cell}>{formatDate(row.date)}</td>
                  <td className={cell}>{typeLabel(row.type)}{row.description && <span className="block text-xs text-[var(--chart-axis)]">{row.description}</span>}</td>
                  <td className={cell}>{row.owedTo || '—'}</td>
                  <td className={`${cell} text-right font-semibold tabular-nums`}>{money(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
