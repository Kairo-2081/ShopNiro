import React from 'react';
import { useLocale } from '../../lib/i18n';
import { Product } from '../../types';
import { ChartPanel } from '../charts/ChartPanel';
import { ShareBreakdown, ShareSlice } from '../charts/ShareBreakdown';

interface SellerStockHealthProps {
  products: readonly Product[];
}

const LOW_STOCK_LIMIT = 5;

/** Sorts a seller's listings into healthy, low and out of stock, using the same 5-unit "low" line as the product list. */
export const SellerStockHealth: React.FC<SellerStockHealthProps> = ({ products }) => {
  const { t, locale } = useLocale();
  const counts = products.reduce(
    (acc, product) => {
      const stock = Number(product.Stock) || 0;
      if (stock <= 0) acc.out += 1;
      else if (stock <= LOW_STOCK_LIMIT) acc.low += 1;
      else acc.healthy += 1;
      return acc;
    },
    { healthy: 0, low: 0, out: 0 },
  );
  const slices: ShareSlice[] = [
    { key: 'healthy', name: t('stockHealthHealthy'), value: counts.healthy, color: 'var(--chart-positive)' },
    { key: 'low', name: t('stockHealthLow'), value: counts.low, color: 'var(--chart-cat-5)' },
    { key: 'out', name: t('stockHealthOut'), value: counts.out, color: 'var(--chart-negative)' },
  ].filter((slice) => slice.value > 0);

  return (
    <ChartPanel headingId="seller-stock-health-title" title={t('stockHealthTitle')} subtitle={t('stockHealthSubtitle')}>
      {slices.length ? (
        <ShareBreakdown
          slices={slices}
          centerValue={products.length.toLocaleString(locale === 'bn' ? 'bn-BD' : 'en-BD')}
          centerLabel={t('stockHealthProducts')}
          ariaLabel={t('stockHealthAria')}
          unit={t('stockHealthUnit')}
          variant="gauge"
        />
      ) : (
        <p className="py-12 text-center text-sm text-[var(--chart-axis)]">{t('stockHealthEmpty')}</p>
      )}
    </ChartPanel>
  );
};
