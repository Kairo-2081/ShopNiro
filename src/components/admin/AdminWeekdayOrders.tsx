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

  return (
    <ChartPanel headingId="admin-weekday-title" title={t('adminWeekdayTitle')} subtitle={t('adminWeekdaySubtitle')}>
      {total > 0 ? (
        <MonthlyBarChart
          data={counts.map((value, index) => ({ label: labels[index], value }))}
          name={t('chartOrders')}
          formatValue={(value) => value.toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-BD')}
          ariaLabel={t('adminWeekdayAria')}
          highlight="max"
        />
      ) : (
        <p className="py-12 text-center text-sm text-[var(--chart-axis)]">{t('adminWeekdayEmpty')}</p>
      )}
    </ChartPanel>
  );
};
