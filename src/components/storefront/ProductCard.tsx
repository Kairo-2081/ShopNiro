import React from 'react';
import { Product, Category, Seller, Review } from '../../types';
import { StarRating } from '../StarRating';
import { api, formatCurrency } from '../../lib/api';
import { discountedPriceForVoucher, describeVoucher, getVoucherCountdownLabel, isVoucherExpired } from '../../lib/vouchers';
import { ShoppingCart, Tag, Store, Eye, Lock, Check, PackageOpen, Heart } from 'lucide-react';
import { useLocale } from '../../lib/i18n';

interface ProductCardProps {
  product: Product;
  category?: Category;
  seller?: Seller;
  reviews: Review[];
  onSelect: (product: Product) => void;
  onAddToCart: (product: Product, e: React.MouseEvent) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (product: Product) => void;
  /** Position in the list, used only to stagger the entrance. */
  index?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  category,
  seller,
  reviews,
  onSelect,
  onAddToCart,
  isWishlisted = false,
  onToggleWishlist,
  index = 0,
}) => {
  const { t } = useLocale();
  const [imgError, setImgError] = React.useState(false);
  const [justAdded, setJustAdded] = React.useState(false);
  const cardRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const card = cardRef.current;
    if (!card || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
        api.trackProductEvent(product.Product_ID, 'impression').catch(() => {});
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(card);
    return () => observer.disconnect();
  }, [product.Product_ID]);

  const productReviews = reviews.filter((r) => r.Product_ID === product.Product_ID);
  const avgRating =
    productReviews.length > 0
      ? productReviews.reduce((sum, r) => sum + r.Rating, 0) / productReviews.length
      : 0;

  const isOutOfStock = Number(product.Stock) <= 0;
  const isDeactivated = product.Product_Status === 'deactivated';
  const hasActiveVoucher = Boolean(product.Voucher && !isVoucherExpired(product.Voucher_Expires_At));
  const voucherCountdown = getVoucherCountdownLabel(product.Voucher_Expires_At);

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock || isDeactivated) return;
    if (product.Sizes?.length) {
      onSelect(product);
      return;
    }
    setJustAdded(true);
    onAddToCart(product, e);
    setTimeout(() => setJustAdded(false), 1500);
  };

  const handleSelect = () => {
    api.trackProductEvent(product.Product_ID, 'click').catch(() => {});
    onSelect(product);
  };

  return (
    <article
      ref={cardRef}
      data-testid="product-card"
      data-product-id={product.Product_ID}
      style={{ '--card-index': index } as React.CSSProperties}
      className="product-card card-rise group relative bg-[#fbfaf6] p-1.5 dark:bg-[linear-gradient(180deg,#292821,#151510)] rounded-[22px] sm:p-2 border border-[#d0c8a5]/20 dark:border-[#d0c8a5]/10 shadow-[0_18px_45px_rgba(6,6,4,0.18)] hover:shadow-[0_28px_60px_rgba(7,7,5,0.24)] hover:border-[#a99b72]/50 overflow-hidden flex flex-col"
    >
      {/* Product Image */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-surface-100 sm:aspect-[4/5] dark:bg-[#0C1014]">
        {product.Image && !imgError ? (
          <img
            src={product.Image}
            alt={product.Name}
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            className="product-card-image w-full h-full object-cover group-hover:scale-[1.035] group-focus-within:scale-[1.035]"
            loading="lazy"
          />
        ) : (
          <div className="relative z-10 flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.30),_transparent_60%),linear-gradient(135deg,#e2e8f0,#cbd5e1_40%,#f8fafc)] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_60%),linear-gradient(135deg,#0f172a,#1e293b_40%,#111827)]">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-surface-200/80 bg-white/65 text-surface-600 shadow-sm backdrop-blur-sm dark:border-surface-700 dark:bg-surface-900/65 dark:text-surface-200">
              <PackageOpen className="h-9 w-9" />
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Voucher Tag */}
            {hasActiveVoucher && (
              <div className="micro-badge absolute top-3 left-3 z-10" title={describeVoucher(product.Voucher)}>
                <Tag className="w-3 h-3" />
                {product.Voucher}
              </div>
            )}

        {/* Stock Badge */}
        <div className="absolute top-3 right-3 z-10">
          {isOutOfStock ? (
            <span className="micro-badge bg-surface-900/80 text-surface-200 border-surface-700">
              {t('outOfStock')}
            </span>
          ) : isDeactivated ? (
            <span className="micro-badge bg-danger-500/90 text-white border-danger-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> {t('deactivated')}
            </span>
          ) : (
            <span className="hidden sm:block">
              <span className="micro-badge border-success-500/20 bg-success-500/10 text-success-700 backdrop-blur dark:text-success-400">
                {product.Stock} {t('inStock')}
              </span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSelect}
          aria-label={`${t('viewDetails')} ${product.Name}`}
          className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d0c8a5]"
        />

        {onToggleWishlist && (
          <button
            type="button"
            aria-label={`${isWishlisted ? t('removeWishlist') : t('saveWishlist')}: ${product.Name}`}
            aria-pressed={isWishlisted}
            onClick={(event) => { event.stopPropagation(); onToggleWishlist(product); }}
            className="absolute bottom-3 right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/90 text-danger-600 shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5] dark:border-surface-700 dark:bg-[#181F2A]/90 dark:text-danger-300"
          >
            <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
          </button>
        )}

        {/* Hover overlay preview action */}
        <div className="absolute inset-0 bg-white/12 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-5 pointer-events-none">
          <span className="translate-y-2 group-hover:translate-y-0 transition-transform duration-300 bg-white/95 dark:bg-[#181F2A]/90 text-surface-900 dark:text-surface-100 border border-surface-200 dark:border-surface-700 text-micro font-semibold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-[#77775a] dark:text-brand-400" /> {t('quickView')}
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="flex flex-1 flex-col justify-between px-1.5 pb-1 pt-3 sm:px-2.5 sm:pt-3.5">
        <div>
          {/* Category & Seller info */}
          <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400 mb-1.5">
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
              {category?.Name || t('generalCategory')}
            </span>
            {seller && (
              <span className="hidden items-center gap-1 text-surface-500 dark:text-surface-400 font-medium text-micro truncate max-w-[120px] sm:flex transition-colors group-hover:text-[#80734f] dark:group-hover:text-[#d0c8a5]">
                <Store className="w-3 h-3 text-surface-500 dark:text-surface-500 shrink-0" />
                <span className="truncate">{seller.Name}</span>
              </span>
            )}
          </div>

          {/* Product Name */}
          <h3 className="font-display line-clamp-2 text-[15px] font-normal leading-snug tracking-[-0.005em] text-surface-900 dark:text-white sm:text-base group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            {product.Name}
          </h3>

          {/* Star Rating */}
          <div className="mt-1.5 sm:mt-2">
            <StarRating rating={avgRating} size="sm" showText compactText totalReviews={productReviews.length} />
          </div>
        </div>

        {/* Price & Action */}
        <div className="mt-3 flex items-end justify-between gap-2 sm:mt-4">
          <div>
                        {hasActiveVoucher ? (
              <>
                <span className="block text-micro text-surface-500 line-through dark:text-surface-500">{formatCurrency(Number(product.Price) || 0)}</span>
                <span className="text-base font-extrabold tabular-nums tracking-tight text-surface-900 dark:text-white sm:text-lg">
                  {formatCurrency(discountedPriceForVoucher(Number(product.Price) || 0, product.Voucher))}
                </span>
                <span className="block text-micro font-medium text-success-700 dark:text-success-300">{product.Voucher}</span>
              </>
            ) : (
              <span className="text-base font-extrabold tabular-nums tracking-tight text-surface-900 dark:text-white sm:text-lg">
                {formatCurrency(Number(product.Price) || 0)}
              </span>
            )}
            {product.Featured_Deal && hasActiveVoucher && (
              <span className="mt-1 block text-micro font-semibold text-warning-700 dark:text-warning-300">
                {t('featuredOffers')}{voucherCountdown ? ` · ${voucherCountdown}` : ''}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={isOutOfStock || isDeactivated}
            onClick={handleAddClick}
            className={`luxury-control min-h-10 w-full rounded-full px-3.5 text-xs cursor-pointer sm:min-h-9 sm:w-auto ${
              isOutOfStock || isDeactivated
                ? 'bg-surface-100 dark:bg-[#181F2A] text-surface-500 dark:text-surface-600 cursor-not-allowed'
                : justAdded
                ? 'bg-[#77775a] text-white shadow-[0_12px_24px_rgba(86,80,57,0.3)] ring-2 ring-[#d9d3b7]/50'
                : 'premium-button text-white'
            }`}
          >
            {justAdded ? (
              <>
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/20 transition-all duration-200 scale-100 opacity-100">
                  <Check className="w-2.5 h-2.5" />
                </span>
                <span className="transition-all duration-200">{t('added')}</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>{product.Sizes?.length ? t('chooseSize') : t('addToCart')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};
