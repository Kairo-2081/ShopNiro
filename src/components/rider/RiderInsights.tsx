import React from 'react';
import { money } from '../../lib/format';
import { useLocale } from '../../lib/i18n';
import { ChartPanel } from '../charts/ChartPanel';
import { ShareBreakdown, ShareSlice } from '../charts/ShareBreakdown';

export interface RiderWalletSummary {
  availableBalance: number;
  lockedCod: number;
  lockedSalary: number;
  pendingSalary: number;
}

interface RiderInsightsProps {
  totalDeliveries: number;
  lateDeliveries: number;
  wallet: RiderWalletSummary | null;
}

const positive = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

/** Two donuts built from numbers the rider dashboard already holds: punctuality and the shape of the wallet. */
export const RiderInsights: React.FC<RiderInsightsProps> = ({ totalDeliveries, lateDeliveries, wallet }) => {
  const { t, locale } = useLocale();
  const formatCount = (value: number) => Math.round(value).toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-BD');

  const late = Math.min(positive(lateDeliveries), positive(totalDeliveries));
  const onTime = positive(totalDeliveries) - late;
  const punctuality: ShareSlice[] = [
    { key: 'on-time', name: t('riderOnTime'), value: onTime, color: 'var(--chart-positive)' },
    { key: 'late', name: t('riderLate'), value: late, color: 'var(--chart-cat-5)' },
  ].filter((slice) => slice.value > 0);

  const walletSlices: ShareSlice[] = wallet
    ? [
        { key: 'available', name: t('riderWalletAvailable'), value: positive(wallet.availableBalance), color: 'var(--chart-cat-6)' },
        { key: 'locked-cod', name: t('riderWalletLockedCod'), value: positive(wallet.lockedCod), color: 'var(--chart-cat-4)' },
        { key: 'locked-salary', name: t('riderWalletLockedSalary'), value: positive(wallet.lockedSalary), color: 'var(--chart-cat-2)' },
        { key: 'pending', name: t('riderWalletPending'), value: positive(wallet.pendingSalary), color: 'var(--chart-cat-5)' },
      ].filter((slice) => slice.value > 0)
    : [];
  const walletTotal = walletSlices.reduce((total, slice) => total + slice.value, 0);

  return (
    <section aria-labelledby="rider-insights-title" className="space-y-4">
      <h2 id="rider-insights-title" className="font-display text-3xl font-normal text-[var(--chart-ink)] sm:text-4xl">{t('riderInsightsTitle')}</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartPanel headingId="rider-punctuality-title" title={t('riderPunctualityTitle')} subtitle={t('riderPunctualitySubtitle')}>
          {punctuality.length ? (
            <ShareBreakdown slices={punctuality} centerValue={formatCount(positive(totalDeliveries))} centerLabel={t('chartDelivered')} ariaLabel={t('riderPunctualityAria')} unit={t('chartDelivered')} />
          ) : (
            <p className="py-12 text-center text-sm text-[var(--chart-axis)]">{t('riderNoDeliveriesYet')}</p>
          )}
        </ChartPanel>
        <ChartPanel headingId="rider-wallet-title" title={t('riderWalletTitle')} subtitle={t('riderWalletSubtitle')}>
          {walletSlices.length ? (
            <ShareBreakdown slices={walletSlices} centerValue={money(walletTotal)} centerLabel="BDT" ariaLabel={t('riderWalletAria')} unit="BDT" />
          ) : (
            <p className="py-12 text-center text-sm text-[var(--chart-axis)]">{t('riderNoWalletYet')}</p>
          )}
        </ChartPanel>
      </div>
    </section>
  );
};
