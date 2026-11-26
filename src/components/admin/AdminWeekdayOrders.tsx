import React from 'react';
import { useLocale } from '../../lib/i18n';
import { Order } from '../../types';
import { ordersByWeekday } from './weekdayOrders';
import { ChartPanel } from '../charts/ChartPanel';
import { MonthlyBarChart } from '../charts/MonthlyBarChart';

interface AdminWeekdayOrdersProps {
  orders: Order[];
}

export const AdminWeekdayOrders: React.FC<AdminWeekdayOrdersProps> = ({ orders }) => {
  const { t, locale } = useLocale();
  const counts = React.useMemo(() => ordersByWeekday(orders), [orders]);
  const formatter = new Intl.DateTimeFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', { weekday: 'short' });
  // 2024-01-06 was a Saturday, so seven consecutive days from it label the bars in the same order as the counts.
  const labels = counts.map((_, index) => formatter.format(new Date(2024, 0, 6 + index)));
  const total = counts.reduce((a, b) => a + b, 0);
  const longFormatter = new Intl.DateTimeFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', { weekday: 'long' });
  const busiest = counts
    .map((value, index) => ({ value, name: longFormatter.format(new Date(2024, 0, 6 + index)) }))
    .filter((day) => day.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 2);
  // Name the two busiest days only when they really lead the rest, so a flat week does not claim a winner.
  const subtitle = busiest.length === 2 && busiest[1].value > busiest[0].value * 0.6 ? t('adminWeekdayBusiestTwo', { first: busiest[0].name, second: busiest[1].name }) : busiest.length ? t('adminWeekdayBusiestOne', { day: busiest[0].name }) : t('adminWeekdaySubtitle');

  return (
    <ChartPanel headingId="admin-weekday-title" title={t('adminWeekdayTitle')} subtitle={subtitle} className="h-full">
      {total > 0 ? (
        <MonthlyBarChart
          data={counts.map((value, index) => ({ label: labels[index], value }))}
          name={t('chartOrders')}
          formatValue={(value) => value.toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-BD')}
          ariaLabel={t('adminWeekdayAria')}
          highlight="max"
          compact
          height={280}
        />
      ) : (
        <p className="py-12 text-center text-sm text-[var(--chart-axis)]">{t('adminWeekdayEmpty')}</p>
      )}
    </ChartPanel>
  );
};
