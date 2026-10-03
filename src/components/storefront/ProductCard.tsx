import React from 'react';
import { Product, Category, Seller, Review } from '../../types';
import { StarRating } from '../StarRating';
import { api, formatCurrency } from '../../lib/api';
import { discountedPriceForVoucher, describeVoucher, getVoucherCountdownLabel, isVoucherExpired } from '../../lib/vouchers';
import { ShoppingCart, Tag, Store, Eye, Lock, Check, PackageOpen } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  category?: Category;
  seller?: Seller;
  reviews: Review[];
  onSelect: (product: Product) => void;
  onAddToCart: (product: Product, e: React.MouseEvent) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  category,
  seller,
  reviews,
  onSelect,
  onAddToCart,
}) => {
  const [imgError, setImgError] = React.useState(false);
  const [justAdded, setJustAdded] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement | null>(null);

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

  return (
    <div
      ref={cardRef}
      onClick={() => {
        api.trackProductEvent(product.Product_ID, 'click').catch(() => {});
        onSelect(product);
      }}
      className="product-card group relative bg-[linear-gradient(180deg,rgba(246,245,239,0.98),rgba(228,226,213,0.96))] dark:bg-[linear-gradient(180deg,#292821,#151510)] rounded-[28px] border border-[#d0c8a5]/20 dark:border-[#d0c8a5]/10 shadow-[0_18px_45px_rgba(6,6,4,0.18)] hover:shadow-[0_28px_60px_rgba(7,7,5,0.24)] hover:border-[#a99b72]/50 overflow-hidden flex flex-col cursor-pointer"
    >
      {/* Product Image */}
      <div className="relative aspect-[4/5] w-full bg-slate-100 dark:bg-[#0C1014] overflow-hidden">
        <div className="absolute inset-0 bg-slate-200/70 dark:bg-zinc-800/80 shimmer skeleton-block" />
        {product.Image && !imgError ? (
          <img
            src={product.Image}
            alt={product.Name}
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            className="product-card-image w-full h-full object-cover group-hover:scale-[1.035]"
            loading="lazy"
          />
        ) : (
          <div className="relative z-10 flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.30),_transparent_60%),linear-gradient(135deg,#e2e8f0,#cbd5e1_40%,#f8fafc)] dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_60%),linear-gradient(135deg,#0f172a,#1e293b_40%,#111827)]">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-200/80 bg-white/65 text-slate-600 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-200">
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
            <span className="micro-badge bg-slate-900/80 text-slate-200 border-slate-700">
              Out of Stock
            </span>
          ) : isDeactivated ? (
            <span className="micro-badge bg-rose-500/90 text-white border-rose-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Deactivated
            </span>
          ) : (
            <span className="micro-badge bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 backdrop-blur">
              {product.Stock} in stock
            </span>
          )}
        </div>

        {/* Hover overlay preview action */}
        <div className="absolute inset-0 bg-white/12 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-5 pointer-events-none">
          <span className="translate-y-2 group-hover:translate-y-0 transition-transform duration-300 bg-white/95 dark:bg-[#181F2A]/90 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-[#77775a] dark:text-sky-400" /> Quick View
          </span>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Category & Seller info */}
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 mb-1.5">
            <span className="font-bold text-blue-600 dark:text-sky-400 text-[11px] uppercase tracking-wider">
              {category?.Name || 'General'}
            </span>
            {seller && (
              <span className="flex items-center gap-1 text-slate-500 dark:text-zinc-400 font-medium text-[11px] truncate max-w-[120px]">
                <Store className="w-3 h-3 text-slate-400 dark:text-zinc-500 shrink-0" />
                <span className="truncate">{seller.Name}</span>
              </span>
            )}
          </div>

          {/* Product Name */}
          <h3 className="font-bold text-slate-900 dark:text-white line-clamp-2 text-sm group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors">
            {product.Name}
          </h3>

          {/* Star Rating */}
          <div className="mt-2">
            <StarRating rating={avgRating} size="sm" showText totalReviews={productReviews.length} />
          </div>
        </div>

        {/* Price & Action */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase tracking-wider block font-semibold">Price</span>
            {hasActiveVoucher ? (
              <>
                <span className="block text-[10px] text-slate-500 line-through dark:text-zinc-500">{formatCurrency(Number(product.Price) || 0)}</span>
                <span className="text-base font-black text-slate-900 dark:text-white">
                  {formatCurrency(discountedPriceForVoucher(Number(product.Price) || 0, product.Voucher))}
                </span>
                <span className="block text-[9px] font-medium text-emerald-700 dark:text-emerald-300">with {product.Voucher}</span>
              </>
            ) : (
              <span className="text-base font-black text-slate-900 dark:text-white">
                {formatCurrency(Number(product.Price) || 0)}
              </span>
            )}
            {product.Featured_Deal && hasActiveVoucher && (
              <span className="mt-1 block text-[9px] font-semibold text-amber-700 dark:text-amber-300">
                Featured deal{voucherCountdown ? ` · ${voucherCountdown}` : ''}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={isOutOfStock || isDeactivated}
            onClick={handleAddClick}
            className={`luxury-control min-h-9 px-3.5 rounded-full text-xs cursor-pointer ${
              isOutOfStock || isDeactivated
                ? 'bg-slate-100 dark:bg-[#181F2A] text-slate-400 dark:text-zinc-600 cursor-not-allowed'
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
                <span className="transition-all duration-200">Added</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>{product.Sizes?.length ? 'Choose size' : 'Add to Cart'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
