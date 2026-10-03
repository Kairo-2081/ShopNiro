import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Product, Category, Seller, Review, Customer, ProductBundle } from '../../types';
import { StarRating } from '../StarRating';
import { api, fetchRelatedProducts, formatCurrency, formatDate } from '../../lib/api';
import { describeVoucher, discountedPriceForVoucher, getVoucherCountdownLabel, isVoucherExpired } from '../../lib/vouchers';
import {
  X,
  ShoppingCart,
  Tag,
  Store,
  MapPin,
  CheckCircle2,
  MessageSquare,
  Send,
  UserCheck,
  LogIn,
  Check,
  Sparkles,
} from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  category?: Category;
  seller?: Seller;
  reviews: Review[];
  allProducts?: Product[];
  currentCustomer?: Customer | null;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number, size?: string) => void;
  onBuyNow: (product: Product, quantity: number, size?: string) => void;
  onSubmitReview: (productId: string, rating: number, reviewText: string) => void;
  onSelectProduct?: (product: Product) => void;
  onOpenLogin?: () => void;
  onAskAI?: (query: string) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  category,
  seller,
  reviews,
  allProducts = [],
  currentCustomer,
  onClose,
  onAddToCart,
  onBuyNow,
  onSubmitReview,
  onSelectProduct,
  onOpenLogin,
  onAskAI,
}) => {
  const [quantity, setQuantity] = React.useState(1);
  const [selectedSize, setSelectedSize] = React.useState('');
  const [galleryIndex, setGalleryIndex] = React.useState(0);
  const [newRating, setNewRating] = React.useState(0);
  const [newReviewText, setNewReviewText] = React.useState('');
  const [reviewSentiment, setReviewSentiment] = React.useState<'good' | 'bad'>('good');
  const [isDraftingReview, setIsDraftingReview] = React.useState(false);
  const [reviewDraftError, setReviewDraftError] = React.useState('');
  const [isSubmittingReview, setIsSubmittingReview] = React.useState(false);
  const [reviewSubmittedMessage, setReviewSubmittedMessage] = React.useState('');
  const [imgError, setImgError] = React.useState(false);
  const [justAdded, setJustAdded] = React.useState(false);

  const [shouldRender, setShouldRender] = React.useState(Boolean(product));
  const [visible, setVisible] = React.useState(Boolean(product));
  const [coPurchasedIds, setCoPurchasedIds] = React.useState<string[]>([]);
  const [availableBundles, setAvailableBundles] = React.useState<ProductBundle[]>([]);

  React.useEffect(() => {
    let isMounted = true;
    if (!product) {
      setCoPurchasedIds([]);
      return () => { isMounted = false; };
    }
    fetchRelatedProducts(product.Product_ID, 5)
      .then((results) => { if (isMounted) setCoPurchasedIds(results.map((result) => result.product_id)); })
      .catch(() => { if (isMounted) setCoPurchasedIds([]); });
    return () => { isMounted = false; };
  }, [product?.Product_ID]);

  React.useEffect(() => {
    let isMounted = true;
    api.getBundles().then((result) => {
      if (isMounted) setAvailableBundles(result);
    }).catch(() => {
      if (isMounted) setAvailableBundles([]);
    });
    return () => { isMounted = false; };
  }, [product?.Product_ID]);

  const relatedProducts = React.useMemo(() => {
    if (!product) return { products: [], basedOnOrders: false };
    const activeProducts = allProducts.filter((candidate) => candidate.Product_ID !== product.Product_ID
      && candidate.Product_Status === 'active'
      && Number(candidate.Stock) > 0);
    const productById = new Map(activeProducts.map((candidate) => [candidate.Product_ID, candidate]));
    const coPurchased = coPurchasedIds.map((productId) => productById.get(productId)).filter((item): item is Product => Boolean(item));
    const suggestions = coPurchased.length
      ? coPurchased.slice(0, 3)
      : activeProducts.filter((candidate) => candidate.Category_ID === product.Category_ID).slice(0, 3);
    return {
      products: suggestions,
      basedOnOrders: coPurchased.length > 0,
    };
  }, [allProducts, coPurchasedIds, product?.Category_ID, product?.Product_ID]);
  const matchingBundles = product
    ? availableBundles.filter((bundle) => bundle.Product_IDs.includes(product.Product_ID))
    : [];

  React.useEffect(() => {
    if (product) {
      setShouldRender(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    setVisible(false);
    const timer = window.setTimeout(() => setShouldRender(false), 260);
    return () => window.clearTimeout(timer);
  }, [product]);

  React.useEffect(() => {
    setNewRating(0);
    setNewReviewText('');
    setReviewSubmittedMessage('');
    setSelectedSize('');
    setGalleryIndex(0);
    setImgError(false);
    setReviewDraftError('');
  }, [product?.Product_ID]);

  if (!shouldRender || !product) return null;

  const productReviews = reviews.filter((r) => r.Product_ID === product.Product_ID);
  const avgRating =
    productReviews.length > 0
      ? productReviews.reduce((sum, r) => sum + r.Rating, 0) / productReviews.length
      : 0;

  const isOutOfStock = Number(product.Stock) <= 0;
  const isDeactivated = product.Product_Status === 'deactivated';
  const productImages = product.Images?.length ? product.Images : [product.Image];
  const selectedImage = productImages[galleryIndex] || product.Image;
  const hasActiveVoucher = Boolean(product.Voucher && !isVoucherExpired(product.Voucher_Expires_At));
  const voucherPrice = hasActiveVoucher ? discountedPriceForVoucher(Number(product.Price) || 0, product.Voucher) : Number(product.Price) || 0;
  const hasVoucherDiscount = Boolean(hasActiveVoucher && voucherPrice < Number(product.Price));
  const voucherCountdown = getVoucherCountdownLabel(product.Voucher_Expires_At);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewText.trim() || newRating < 1) return;
    setIsSubmittingReview(true);
    try {
      await onSubmitReview(product.Product_ID, newRating, newReviewText.trim());
      setNewRating(0);
      setNewReviewText('');
      setReviewSubmittedMessage('Thank you! Your review has been recorded.');
      setTimeout(() => setReviewSubmittedMessage(''), 4000);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleAddToCartClick = () => {
    if (isOutOfStock || isDeactivated) return;
    if (product.Sizes?.length && !selectedSize) return;
    setJustAdded(true);
    onAddToCart(product, quantity, selectedSize || undefined);
    setTimeout(() => {
      setJustAdded(false);
      onClose();
    }, 500);
  };

  const draftReview = async () => {
    setIsDraftingReview(true);
    setReviewDraftError('');
    try {
      const result = await api.generateAIReviewDraft({
        productName: product.Name,
        productDescription: product.Description,
        sentiment: reviewSentiment,
        notes: newReviewText,
      });
      setNewReviewText(result.draft);
    } catch (error: any) {
      setReviewDraftError(error.message || 'Could not draft a review.');
    } finally {
      setIsDraftingReview(false);
    }
  };

  const defaultPlaceholder = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&auto=format&fit=crop&q=80';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 overflow-y-auto transition-opacity duration-250 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        className={`relative bg-white dark:bg-[#12161D] w-full max-w-4xl rounded-3xl shadow-2xl border border-sky-100 dark:border-zinc-800 overflow-hidden my-8 max-h-[90vh] flex flex-col transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-[0.97] opacity-0'}`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-[#161C24]/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-sky-400">
              {category?.Name || 'Product Detail'}
            </span>
            <span className="text-slate-300 dark:text-zinc-700">•</span>
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">ID: {product.Product_ID}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-8 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column - Product Image */}
            <div className="space-y-4">
              <div className="aspect-square w-full rounded-2xl bg-slate-100 dark:bg-[#0C1014] overflow-hidden border border-slate-200 dark:border-zinc-800 relative">
                <img
                  src={imgError || !selectedImage ? defaultPlaceholder : selectedImage}
                  alt={product.Name}
                  onError={() => setImgError(true)}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                {product.Voucher && (
                  <div className="absolute top-4 left-4 bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                    <Tag className="w-4 h-4" />
                    Voucher: {product.Voucher}
                  </div>
                )}
              </div>
              {productImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {productImages.map((imageUrl, index) => (
                    <button key={`${imageUrl}-${index}`} type="button" onClick={() => { setGalleryIndex(index); setImgError(false); }} aria-label={`Show product image ${index + 1}`} aria-pressed={galleryIndex === index} className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${galleryIndex === index ? 'border-blue-600' : 'border-slate-200 dark:border-zinc-700'}`}>
                      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              {product.Video_URL && (
                <video controls preload="metadata" src={product.Video_URL} className="w-full rounded-xl border border-slate-200 bg-black dark:border-zinc-800">
                  Your browser does not support product video playback.
                </video>
              )}

              {/* Seller Info Box */}
              {seller && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#161C24] border border-slate-200 dark:border-zinc-800 flex items-start gap-3">
                  <img
                    src={seller.Logo || defaultPlaceholder}
                    alt={seller.Name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = defaultPlaceholder;
                    }}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                  />
                  <div className="flex-1 text-xs space-y-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5 truncate">
                        <Store className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="truncate">{seller.Name}</span>
                      </span>
                      <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-semibold text-[10px] uppercase shrink-0 border border-emerald-500/20">
                        Approved Seller
                      </span>
                    </div>
                    {seller.Description && (
                      <p className="text-slate-600 dark:text-zinc-300 line-clamp-2">{seller.Description}</p>
                    )}
                    {seller.Address && (
                      <p className="text-slate-500 dark:text-zinc-400 flex items-center gap-1 font-mono text-[11px] pt-1 truncate">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {seller.Address.Street}, {seller.Address.City} ({seller.Address.Postal_Code})
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Product Meta & Actions */}
            <div className="flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                  {product.Name}
                </h1>

                {/* Rating Summary */}
                <div className="flex items-center gap-3">
                  <StarRating rating={avgRating} size="md" showText totalReviews={productReviews.length} />
                  <span className="text-slate-300 dark:text-zinc-700">•</span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Available from this seller
                  </span>
                </div>

                {/* Price Display */}
                <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-[#161C24] border border-blue-100 dark:border-blue-900/40 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold block">
                      {hasVoucherDiscount ? 'Price with code' : 'Price'}
                    </span>
                    <span className="text-3xl font-black text-blue-600 dark:text-sky-400">
                      {formatCurrency(voucherPrice)}
                    </span>
                    {hasVoucherDiscount && <span className="ml-2 text-xs text-slate-500 line-through dark:text-zinc-500">{formatCurrency(Number(product.Price))}</span>}
                  </div>
                  {hasActiveVoucher && (
                    <span title={describeVoucher(product.Voucher)} className="max-w-[180px] text-right text-[10px] font-semibold text-blue-700 dark:text-sky-300">
                      <span className="block">Use code <code className="font-bold">{product.Voucher}</code></span>
                      <span className="mt-0.5 block font-normal text-slate-500 dark:text-zinc-400">{describeVoucher(product.Voucher)}</span>
                      {voucherCountdown && <span className="mt-0.5 block font-semibold text-amber-700 dark:text-amber-300">{voucherCountdown}</span>}
                    </span>
                  )}
                </div>

                {/* Description */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">
                    Product Details
                  </h3>
                  <div className="space-y-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
                    <ReactMarkdown components={{
                      h1: ({ children }) => <h2 className="pt-2 text-sm font-bold text-slate-900 dark:text-white">{children}</h2>,
                      h2: ({ children }) => <h2 className="pt-2 text-sm font-bold text-slate-900 dark:text-white">{children}</h2>,
                      h3: ({ children }) => <h3 className="pt-1 text-xs font-bold text-slate-900 dark:text-white">{children}</h3>,
                      p: ({ children }) => <p>{children}</p>,
                      strong: ({ children }) => <strong className="font-bold text-slate-900 dark:text-white">{children}</strong>,
                      ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                    }}>
                      {product.Description || 'No description provided.'}
                    </ReactMarkdown>
                  </div>
                </div>

                {product.Highlights?.some((highlight) => highlight.trim()) && (
                  <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-[#161C24]">
                    <h3 className="mb-2 text-xs font-bold text-slate-800 dark:text-zinc-200">Key product specs</h3>
                    <ul className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-300">
                      {product.Highlights.filter((highlight) => highlight.trim()).map((highlight) => (
                        <li key={highlight} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {(product.Warranty_Information || product.Return_Policy) && (
                  <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-[#161C24]">
                    <h3 className="mb-2 text-xs font-bold text-slate-800 dark:text-zinc-200">Seller-provided policies</h3>
                    {product.Warranty_Information && <p className="text-xs text-slate-600 dark:text-zinc-300"><strong>Warranty:</strong> {product.Warranty_Information}</p>}
                    {product.Return_Policy && <p className="mt-1 text-xs text-slate-600 dark:text-zinc-300"><strong>Returns:</strong> {product.Return_Policy}</p>}
                  </section>
                )}

                {/* Specs pills */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#161C24] border border-slate-200 dark:border-zinc-800">
                    <span className="text-slate-400 dark:text-zinc-500 block text-[10px] uppercase font-bold">Category</span>
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">{category?.Name || 'General'}</span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-[#161C24] border border-slate-200 dark:border-zinc-800">
                    <span className="text-slate-400 dark:text-zinc-500 block text-[10px] uppercase font-bold">Available Inventory</span>
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">{product.Stock} units</span>
                  </div>
                </div>
              </div>

              {/* Quantity & Add to Cart */}
              <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 space-y-4">
                {product.Sizes?.length ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Choose size{product.Size_Gender ? ` · ${product.Size_Gender}` : ''}</span>
                      {product.Size_Chart?.length ? <span className="text-[10px] text-slate-500">Measurements in cm</span> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {product.Sizes.map((size) => <button key={size} type="button" aria-pressed={selectedSize === size} onClick={() => setSelectedSize(size)} className={`min-w-10 rounded-lg border px-3 py-2 text-xs font-bold ${selectedSize === size ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 text-slate-700 dark:border-zinc-700 dark:text-zinc-300'}`}>{size}</button>)}
                    </div>
                    {product.Size_Chart?.length ? (
                      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-800">
                        <table className="w-full min-w-[420px] text-left text-[10px]">
                          <thead className="bg-slate-50 text-slate-500 dark:bg-[#181F2A] dark:text-zinc-400"><tr><th className="p-2">Size</th><th>Chest</th><th>Waist</th><th>Hip</th><th>Length</th></tr></thead>
                          <tbody>{product.Size_Chart.filter((row) => product.Sizes?.includes(row.Size)).map((row) => <tr key={row.Size} className="border-t border-slate-100 dark:border-zinc-800"><td className="p-2 font-bold">{row.Size}</td><td>{row.Chest_CM ?? '-'}</td><td>{row.Waist_CM ?? '-'}</td><td>{row.Hip_CM ?? '-'}</td><td>{row.Length_CM ?? '-'}</td></tr>)}</tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex items-center gap-4">
                  <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Quantity:</span>
                  <div className="flex items-center border border-slate-200 dark:border-zinc-700 rounded-full overflow-hidden bg-slate-50 dark:bg-[#181F2A]">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="px-3.5 py-1.5 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 font-bold text-sm cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-4 py-1 text-sm font-bold text-slate-900 dark:text-white">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(Math.max(1, Number(product.Stock) || 99), q + 1))}
                      className="px-3.5 py-1.5 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 font-bold text-sm cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={isOutOfStock || isDeactivated || Boolean(product.Sizes?.length && !selectedSize)}
                    onClick={handleAddToCartClick}
                    className={`w-full py-3.5 px-4 rounded-full font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isOutOfStock || isDeactivated || Boolean(product.Sizes?.length && !selectedSize)
                        ? 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600 cursor-not-allowed'
                        : justAdded
                        ? 'bg-emerald-600 text-white shadow-emerald-500/25'
                        : 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-[#202938] dark:text-white dark:hover:bg-[#2b3749]'
                    }`}
                  >
                    {justAdded ? <Check className="w-5 h-5" /> : <ShoppingCart className="w-5 h-5" />}
                    <span>{justAdded ? 'Added to cart' : 'Add to Cart'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isOutOfStock || isDeactivated || Boolean(product.Sizes?.length && !selectedSize)}
                    onClick={() => onBuyNow(product, quantity, selectedSize || undefined)}
                    className="w-full rounded-full bg-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
                  >
                    Buy Now · {formatCurrency(Number(product.Price) * quantity)}
                  </button>
                </div>

                {onAskAI && (
                  <button
                    type="button"
                    onClick={() => {
                      onAskAI(
                        `Tell me more about "${product.Name}". What are its key specifications, highlights, current stock status, and are there any active vouchers I can use?`
                      );
                      onClose();
                    }}
                    className="w-full py-2.5 px-4 rounded-full font-semibold text-xs border border-blue-500/30 text-blue-600 dark:text-sky-400 bg-blue-50/50 dark:bg-[#181F2A] hover:bg-blue-100 dark:hover:bg-[#202938] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                  >
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Ask ShopNiro AI Assistant about this product</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {relatedProducts.products.length > 0 && (
            <section className="space-y-3 border-t border-slate-200 pt-6 dark:border-zinc-800">
              <header>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {relatedProducts.basedOnOrders ? 'Frequently bought together' : 'You may also like'}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                  {relatedProducts.basedOnOrders ? 'Suggestions based on products in the same orders.' : 'More available products from the marketplace.'}
                </p>
              </header>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {relatedProducts.products.map((suggestion) => (
                  <article key={suggestion.Product_ID} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-zinc-800 dark:bg-[#161C24]">
                    <img src={suggestion.Image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" loading="lazy" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{suggestion.Name}</p>
                      <p className="mt-0.5 text-xs font-bold text-slate-700 dark:text-zinc-200">{formatCurrency(Number(suggestion.Price))}</p>
                      <button
                        type="button"
                        onClick={() => suggestion.Sizes?.length ? onSelectProduct?.(suggestion) : onAddToCart(suggestion, 1)}
                        className="mt-1 text-[10px] font-semibold text-blue-700 hover:underline dark:text-sky-300"
                      >
                        {suggestion.Sizes?.length ? 'Choose options' : 'Add to cart'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {matchingBundles.length > 0 && (
            <section className="space-y-3 border-t border-slate-200 pt-6 dark:border-zinc-800">
              <header>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Bundle and save</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Add every item in a bundle to your cart; savings are applied at checkout and can stack with vouchers.</p>
              </header>
              {matchingBundles.map((bundle) => (
                <article key={bundle.Bundle_ID} className="border-l-2 border-amber-400 bg-amber-50/70 p-4 dark:bg-amber-950/20">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{bundle.Name} · {bundle.Discount_Percent}% off</h3>
                  {bundle.Ends_At && <p className="mt-1 text-[10px] text-amber-800 dark:text-amber-300">Offer ends {new Date(bundle.Ends_At).toLocaleString()}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {bundle.Product_IDs.filter((productId) => productId !== product.Product_ID).map((productId) => {
                      const bundleProduct = allProducts.find((candidate) => candidate.Product_ID === productId);
                      if (!bundleProduct) return null;
                      return <button key={productId} type="button" onClick={() => bundleProduct.Sizes?.length ? onSelectProduct?.(bundleProduct) : onAddToCart(bundleProduct, 1)} className="rounded-md border border-amber-300 px-3 py-2 text-[10px] font-bold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/50">Add {bundleProduct.Name}</button>;
                    })}
                  </div>
                </article>
              ))}
            </section>
          )}

          {/* Customer Reviews Section */}
          <div className="pt-8 border-t border-slate-200 dark:border-zinc-800 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-600 dark:text-sky-400" />
                  Customer Reviews ({productReviews.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Verified customer ratings and feedback
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StarRating rating={avgRating} size="lg" showText totalReviews={productReviews.length} />
              </div>
            </div>

            {/* Write a Review Form or Guest Login Prompt */}
            <div className="p-5 rounded-3xl bg-slate-50 dark:bg-[#161C24] border border-slate-200 dark:border-zinc-800 space-y-3">
              {currentCustomer ? (
                <>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-emerald-500" />
                    Leave a Review as {currentCustomer.Name}
                  </h3>

                  {reviewSubmittedMessage && (
                    <div className="p-3 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 rounded-xl text-xs font-semibold">
                      {reviewSubmittedMessage}
                    </div>
                  )}

                  <form onSubmit={handleReviewSubmit} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Your Rating:</span>
                      <StarRating
                        rating={newRating}
                        interactive
                        size="md"
                        onRatingChange={(r) => setNewRating(r)}
                      />
                      <span className="text-xs font-bold text-amber-500">
                        {newRating > 0 ? `${newRating} / 5 stars` : 'Choose a rating'}
                      </span>
                    </div>

                    <textarea
                      rows={2}
                      value={newReviewText}
                      onChange={(e) => setNewReviewText(e.target.value)}
                      placeholder="Share your experience with this product..."
                      className="w-full p-3 text-xs bg-white dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-zinc-100 placeholder-slate-400"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-zinc-700 dark:bg-[#181F2A]">
                        {(['good', 'bad'] as const).map((sentiment) => <button key={sentiment} type="button" aria-pressed={reviewSentiment === sentiment} onClick={() => setReviewSentiment(sentiment)} className={`rounded-md px-3 py-1.5 text-[11px] font-bold capitalize ${reviewSentiment === sentiment ? 'bg-blue-700 text-white' : 'text-slate-600 dark:text-zinc-300'}`}>{sentiment}</button>)}
                      </div>
                      <button type="button" onClick={() => void draftReview()} disabled={isDraftingReview} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-50 dark:border-blue-900 dark:text-sky-300"><Sparkles className="h-3.5 w-3.5" />{isDraftingReview ? 'Drafting...' : 'Draft with AI'}</button>
                    </div>
                    {reviewDraftError && <p role="alert" className="text-xs text-rose-600">{reviewDraftError}</p>}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isSubmittingReview || !newReviewText.trim() || newRating < 1}
                        className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-full text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Post review</span>
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="text-center py-4 space-y-2">
                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    Sign in to leave a verified review and rating for this product.
                  </p>
                  {onOpenLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenLogin();
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-xs font-bold shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In to Review</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Existing Reviews List */}
            <div className="space-y-3">
              {productReviews.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-zinc-500 text-center py-4 italic">
                  No customer reviews yet. Be the first to review this product!
                </p>
              ) : (
                productReviews.map((rev) => (
                  <div
                    key={rev.Review_ID}
                    className="p-4 rounded-2xl bg-white dark:bg-[#161C24] border border-slate-100 dark:border-zinc-800 space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-blue-600/10 dark:bg-blue-950/80 text-blue-600 dark:text-sky-400 flex items-center justify-center font-bold text-xs">
                          {rev.Customer_ID.slice(-2)}
                        </span>
                        <div>
                          <span className="text-xs font-semibold text-slate-900 dark:text-white block leading-tight">
                            Verified Customer #{rev.Customer_ID}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                            {formatDate(rev.Created_At)}
                          </span>
                        </div>
                      </div>
                      <StarRating rating={rev.Rating} size="sm" />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed pl-9">
                      {rev.Review_text}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
