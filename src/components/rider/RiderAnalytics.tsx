import React from 'react';
import { api } from '../../lib/api';
import { money } from '../../lib/format';
import { useLocale } from '../../lib/i18n';
import { Rider, RiderDelivery } from '../../types';
import { ChartPanel } from '../charts/ChartPanel';
import { ShareBreakdown, ShareSlice } from '../charts/ShareBreakdown';
import { StatTile } from '../charts/StatTile';
import { TrendAreaChart } from '../charts/TrendAreaChart';
import { monthBuckets, placedMonthKey } from '../charts/months';
import { RangeMonths, RangeSelector } from '../charts/RangeSelector';
import { RiderInsights, RiderWalletSummary } from './RiderInsights';

interface RiderAnalyticsProps {
  rider: Rider;
}

const DEFAULT_CENTER: [number, number] = [23.8103, 90.4125];
type Wallet = Awaited<ReturnType<typeof api.getRiderWallet>>;

/** Every rider chart on one page: headline figures, punctuality, wallet, salary by month, current jobs and cash on delivery. */
export const RiderAnalytics: React.FC<RiderAnalyticsProps> = ({ rider }) => {
  const { t, locale } = useLocale();
  const [profile, setProfile] = React.useState(rider);
  const [wallet, setWallet] = React.useState<Wallet | null>(null);
  const [deliveries, setDeliveries] = React.useState<RiderDelivery[]>([]);
  const [range, setRange] = React.useState<RangeMonths>(6);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const latitude = rider.Current_Latitude ?? DEFAULT_CENTER[0];
    const longitude = rider.Current_Longitude ?? DEFAULT_CENTER[1];
    void Promise.allSettled([
      api.getRiderProfile().then((next) => active && setProfile(next)),
      api.getRiderWallet().then((next) => active && setWallet(next)),
      api.getRiderDeliveries(latitude, longitude).then((next) => active && setDeliveries(next)),
    ]).then((results) => {
      const failed = results.find((result) => result.status === 'rejected');
      if (active && failed?.status === 'rejected') setError(failed.reason?.message || t('txLoadFailed'));
    });
    return () => { active = false; };
  }, [rider.Current_Latitude, rider.Current_Longitude]);

  const formatCount = (value: number) => Math.round(value).toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-BD');
  const total = Math.max(0, profile.Total_Deliveries || 0);
  const timelyPercent = total > 0 ? Math.round(((profile.Timely_Deliveries || 0) / total) * 100) : 0;

  const salary = React.useMemo(() => {
    const buckets = monthBuckets(range, new Date(), 0, locale === 'bn' ? 'bn-BD' : 'en');
    const sums = new Map(buckets.map((bucket) => [bucket.key, 0]));
    for (const entry of wallet?.entries ?? []) {
      if (entry.entry_type !== 'salary') continue;
      const key = placedMonthKey(entry.created_at);
      if (key && sums.has(key)) sums.set(key, (sums.get(key) || 0) + Math.max(0, Number(entry.amount) || 0));
    }
    return buckets.map((bucket) => ({ label: bucket.label, value: sums.get(bucket.key) || 0 }));
  }, [wallet, range, locale]);
  const hasSalary = salary.some((month) => month.value > 0);

  const mine = deliveries.filter((delivery) => !delivery.Rider_ID || delivery.Rider_ID === profile.Rider_ID);
  const statusLabel: Record<RiderDelivery['Status'], string> = {
    pending: t('riderStatusPending'), accepted: t('riderStatusAccepted'), on_the_way: t('riderStatusOnTheWay'),
    delivered: t('riderStatusDelivered'), cancelled: t('riderStatusCancelled'),
  };
  const statusColor: Record<RiderDelivery['Status'], string> = {
    pending: 'var(--chart-cat-4)', accepted: 'var(--chart-cat-6)', on_the_way: 'var(--chart-primary)',
    delivered: 'var(--chart-positive)', cancelled: 'var(--chart-cat-5)',
  };
  const workload: ShareSlice[] = (Object.keys(statusLabel) as RiderDelivery['Status'][])
    .map((status) => ({ key: status, name: statusLabel[status], value: mine.filter((delivery) => delivery.Status === status).length, color: statusColor[status] }))
    .filter((slice) => slice.value > 0);

  const codJobs = mine.filter((delivery) => delivery.COD_Amount > 0 && delivery.Status !== 'cancelled');
  const codCollected = codJobs.filter((delivery) => delivery.COD_Collected).reduce((sum, delivery) => sum + delivery.COD_Amount, 0);
  const codToCollect = codJobs.filter((delivery) => !delivery.COD_Collected).reduce((sum, delivery) => sum + delivery.COD_Amount, 0);
  const cod: ShareSlice[] = [
    { key: 'collected', name: t('riderCodCollected'), value: codCollected, color: 'var(--chart-positive)' },
    { key: 'to-collect', name: t('riderCodToCollect'), value: codToCollect, color: 'var(--chart-cat-4)' },
  ].filter((slice) => slice.value > 0);

  const walletSummary: RiderWalletSummary | null = wallet;

  return (
    <section aria-labelledby="rider-analytics-title" className="space-y-5">
      <header className="min-w-0">
        <h2 id="rider-analytics-title" className="font-display text-3xl font-normal text-[var(--chart-ink)] sm:text-4xl">{t('riderAnalyticsTitle')}</h2>
        <p className="mt-1.5 text-base text-[var(--chart-axis)]">{t('riderAnalyticsSubtitle')}</p>
      </header>

      {error && <p role="alert" className="rounded-2xl border border-danger-300 bg-danger-50 px-4 py-3 text-sm text-danger-800 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-200">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label={t('riderStatDeliveries')} value={formatCount(total)} count={{ value: total, format: formatCount }} accent="var(--chart-primary)" />
        <StatTile label={t('riderStatOnTime')} value={`${timelyPercent}%`} count={{ value: timelyPercent, format: (value) => `${Math.round(value)}%` }} progress={timelyPercent} accent="var(--chart-positive)" />
        <StatTile label={t('riderStatPoints')} value={`${profile.Performance_Points ?? 0}/100`} progress={Math.max(0, Math.min(100, profile.Performance_Points ?? 0))} accent="var(--chart-cat-6)" />
        <StatTile label={t('riderStatRating')} value={profile.Average_Rating ? `${profile.Average_Rating.toFixed(1)}/5` : t('riderStatNew')} accent="var(--chart-cat-4)" />
      </div>

      <RiderInsights totalDeliveries={profile.Total_Deliveries} lateDeliveries={profile.Late_Deliveries} wallet={walletSummary} />

      <ChartPanel
        headingId="rider-salary-title"
        title={t('riderEarningsTitle')}
        subtitle={t('riderEarningsSubtitle')}
        actions={<RangeSelector value={range} onChange={setRange} />}
        featured
      >
        {hasSalary ? (
          <TrendAreaChart data={salary} name={t('riderEarningsSeries')} formatValue={money} ariaLabel={t('riderEarningsAria')} height={260} />
        ) : (
          <p className="py-12 text-center text-sm text-[var(--chart-axis)]">{t('riderEarningsEmpty')}</p>
        )}
      </ChartPanel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartPanel headingId="rider-workload-title" title={t('riderWorkloadTitle')} subtitle={t('riderWorkloadSubtitle')}>
          {workload.length ? (
            <ShareBreakdown slices={workload} centerValue={formatCount(mine.length)} centerLabel={t('riderWorkloadCenter')} ariaLabel={t('riderWorkloadAria')} unit={t('riderWorkloadCenter')} />
          ) : (
            <p className="py-12 text-center text-sm text-[var(--chart-axis)]">{t('riderWorkloadEmpty')}</p>
          )}
        </ChartPanel>
        <ChartPanel headingId="rider-cod-title" title={t('riderCodTitle')} subtitle={t('riderCodSubtitle')}>
          {cod.length ? (
            <ShareBreakdown slices={cod} centerValue={money(codCollected + codToCollect).replace(/^BDT\s*/, '')} centerLabel="BDT" ariaLabel={t('riderCodAria')} unit="BDT" />
          ) : (
            <p className="py-12 text-center text-sm text-[var(--chart-axis)]">{t('riderCodEmpty')}</p>
          )}
        </ChartPanel>
      </div>
    </section>
  );
};
