import React, { useMemo } from 'react';
import type { Seller } from '../../types';
import { useLocale } from '../../lib/i18n';

// A seller's logo, or the first letter of their name when the picture is missing or fails to load.
const SellerLogo: React.FC<{ logo?: string; name: string }> = ({ logo, name }) => {
  const [failed, setFailed] = React.useState(false);
  if (!logo || failed) {
    return (
      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600/20 text-sm font-bold text-brand-800 dark:text-brand-200">
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }
  return <img src={logo} alt="" loading="lazy" decoding="async" width={48} height={48} className="h-12 w-12 shrink-0 rounded-xl object-cover" onError={() => setFailed(true)} />;
};

export const SellersShowcase: React.FC<{ sellers: Seller[]; onEnterAsGuest: () => void }> = ({ sellers, onEnterAsGuest }) => {
  const { t } = useLocale();

  const approvedSellers = useMemo(
    () =>
      sellers
        .filter((seller) => seller.Status === 'approved')
        .sort((a, b) => a.Name.localeCompare(b.Name, undefined, { sensitivity: 'base' }))
        .slice(0, 8),
    [sellers],
  );

  // A near-empty "sellers already here" block reads as the opposite of trust, so show it only once there are a few.
  if (approvedSellers.length < 3) return null;

  return (
    <section id="sellers" aria-labelledby="sellers-heading" className="scroll-mt-24 py-12 md:py-20">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">{t('sellersSectionEyebrow')}</p>
        <h2 id="sellers-heading" className="mt-2 text-3xl font-medium tracking-[-0.04em] text-surface-900 dark:text-white md:text-4xl">{t('sellersAlreadyOnShopNiro')}</h2>
        <p className="mt-3 text-sm text-surface-600 dark:text-surface-300">{t('sellersReviewedBeforeListing')}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {approvedSellers.map((seller) => (
          <button
            key={seller.Seller_ID}
            type="button"
            onClick={onEnterAsGuest}
            className="flex items-center gap-3 rounded-2xl border border-surface-200 dark:border-surface-700 bg-white/75 dark:bg-[#10161e]/75 p-4 text-left transition-colors hover:border-brand-500/60 hover:bg-white dark:hover:bg-[#121b26] cursor-pointer"
          >
            <SellerLogo logo={seller.Logo} name={seller.Name} />
            <span className="truncate text-sm font-semibold text-surface-900 dark:text-white">{seller.Name}</span>
          </button>
        ))}
      </div>
    </section>
  );
};
