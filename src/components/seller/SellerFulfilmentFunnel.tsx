import React from 'react';
import { useLocale } from '../../lib/i18n';
import { Order } from '../../types';
import { ChartPanel } from '../charts/ChartPanel';

interface SellerFulfilmentFunnelProps {
  orders: readonly Order[];
}

/**
 * How far this store's orders of the last six months got: received, processing, shipped, delivered. Each step counts the
 * orders that reached it or went past it, so the bars can only shrink. Cancelled and refunded orders sit under the bars
 * as shares of everything received.
 */
export const SellerFulfilmentFunnel: React.FC<SellerFulfilmentFunnelProps> = ({ orders }) => {
  const { t, locale } = useLocale();
  const format = (value: number) => value.toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-BD');
  const stats = React.useMemo(() => {
    const since = new Date();
    since.setMonth(since.getMonth() - 6);
    const recent = orders.filter((order) => new Date(order.Order_Placed_At) >= since);
    const live = recent.filter((order) => order.Status !== 'cancelled');
    const count = (statuses: string[]) => live.filter((order) => statuses.includes(order.Status)).length;
    return {
      all: recent.length,
      steps: [
        { key: 'received', label: t('fulfilReceived'), value: live.length, color: 'var(--chart-primary)' },
        { key: 'processing', label: t('fulfilProcessing'), value: count(['processing', 'shipped', 'delivered']), color: 'var(--chart-primary)' },
        { key: 'shipped', label: t('fulfilShipped'), value: count(['shipped', 'delivered']), color: 'var(--chart-primary)' },
        { key: 'delivered', label: t('fulfilDelivered'), value: count(['delivered']), color: 'var(--chart-positive)' },
      ],
      cancelled: recent.filter((order) => order.Status === 'cancelled').length,
      refunded: recent.filter((order) => order.Payment_Status === 'refunded').length,
    };
  }, [orders, t]);
  const top = Math.max(1, ...stats.steps.map((step) => step.value));
  const share = (value: number) => `${stats.all ? Math.round((value / stats.all) * 1000) / 10 : 0}%`;

  return (
    <ChartPanel headingId="seller-fulfilment-title" title={t('fulfilTitle')} subtitle={t('fulfilSubtitle')} className="h-full">
      {stats.all ? (
        <>
          <ul className="space-y-4">
            {stats.steps.map((step) => (
              <li key={step.key}>
                <div className="flex items-baseline justify-between text-[0.95rem]">
                  <span className="text-[var(--chart-axis)]">{step.label}</span>
                  <span className="font-bold tabular-nums text-[var(--chart-ink)]">{format(step.value)}</span>
                </div>
                <div aria-hidden="true" className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[var(--chart-track)]">
                  <div className="h-full rounded-full" style={{ width: `${(step.value / top) * 100}%`, backgroundImage: `linear-gradient(90deg, color-mix(in srgb, ${step.color} 70%, white), ${step.color})` }} />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {[{ label: t('fulfilCancelled'), value: share(stats.cancelled) }, { label: t('fulfilRefunded'), value: share(stats.refunded) }].map((item) => (
              <div key={item.label} className="rounded-2xl border border-[var(--chart-line)] px-4 py-3">
                <p className="text-sm text-[var(--chart-axis)]">{item.label}</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums text-[var(--chart-ink)]">{item.value}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="py-12 text-center text-sm text-[var(--chart-axis)]">{t('fulfilEmpty')}</p>
      )}
    </ChartPanel>
  );
};
