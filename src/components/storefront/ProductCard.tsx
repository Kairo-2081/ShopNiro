import React from 'react';
import { Product, Category, Seller, Review } from '../../types';
import { StarRating } from '../StarRating';
import { formatCurrency } from '../../lib/api';
import { ShoppingCart, Tag, Store, Eye, Lock, Check } from 'lucide-react';

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

  const productReviews = reviews.filter((r) => r.Product_ID === product.Product_ID);
  const avgRating =
    productReviews.length > 0
      ? productReviews.reduce((sum, r) => sum + r.Rating, 0) / productReviews.length
      : 0;

  const isOutOfStock = Number(product.Stock) <= 0;
  const isDeactivated = product.Product_Status === 'deactivated';

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

  const defaultPlaceholder = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80';

  return (
    <div
      onClick={() => onSelect(product)}
      className="group relative bg-[linear-gradient(180deg,rgba(246,245,239,0.98),rgba(228,226,213,0.96))] dark:bg-[linear-gradient(180deg,#292821,#151510)] rounded-[28px] border border-[#d0c8a5]/20 dark:border-[#d0c8a5]/10 shadow-[0_18px_45px_rgba(6,6,4,0.18)] hover:shadow-[0_28px_60px_rgba(7,7,5,0.24)] hover:border-[#a99b72]/50 transition-all duration-200 overflow-hidden flex flex-col cursor-pointer"
    >
      {/* Product Image */}
      <div className="relative aspect-[4/5] w-full bg-slate-100 dark:bg-[#0C1014] overflow-hidden">
        <div className="absolute inset-0 bg-slate-200/70 dark:bg-zinc-800/80 shimmer skeleton-block" />
        <img
          src={imgError || !product.Image ? defaultPlaceholder : product.Image}
          alt={product.Name}
          onError={() => setImgError(true)}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          loading="lazy"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Voucher Tag */}
        {product.Voucher && (
          <div className="micro-badge absolute top-3 left-3 z-10">
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
        <div className="absolute inset-0 bg-slate-900/30 dark:bg-zinc-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <span className="bg-white/95 dark:bg-[#181F2A]/90 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" /> Quick View
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
            <span className="text-base font-black text-slate-900 dark:text-white">
              {formatCurrency(Number(product.Price) || 0)}
            </span>
          </div>

          <button
            type="button"
            disabled={isOutOfStock || isDeactivated}
            onClick={handleAddClick}
            className={`luxury-control min-h-9 px-3.5 rounded-full text-xs cursor-pointer ${
              isOutOfStock || isDeactivated
                ? 'bg-slate-100 dark:bg-[#181F2A] text-slate-400 dark:text-zinc-600 cursor-not-allowed'
                : justAdded
                ? 'bg-[#77775a] text-white shadow-[0_12px_24px_rgba(86,80,57,0.3)]'
                : 'premium-button text-white active:scale-95'
            }`}
          >
            {justAdded ? (
              <>
                <Check className="w-3.5 h-3.5 animate-in zoom-in-50 duration-150" />
                <span>Added</span>
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
