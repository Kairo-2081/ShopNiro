import React from 'react';
import { Product, Category, Seller, Review } from '../../types';
import { ProductCard } from './ProductCard';
import { MarketplaceTrendsTopCharts } from './MarketplaceTrendsTopCharts';
import { formatCurrency } from '../../lib/api';
import { Search, Sparkles, SlidersHorizontal, ShoppingBag, ArrowUpDown, X, Check, Radio } from 'lucide-react';

interface StorefrontProps {
  products: Product[];
  categories: Category[];
  sellers: Seller[];
  reviews: Review[];
  onSelectProduct: (product: Product) => void;
  onAddToCart: (product: Product, quantity?: number) => void;
}

export const Storefront: React.FC<StorefrontProps> = ({
  products,
  categories,
  sellers,
  reviews,
  onSelectProduct,
  onAddToCart,
}) => {
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [stockFilter, setStockFilter] = React.useState<'all' | 'inStock'>('all');
  const [sortBy, setSortBy] = React.useState<'featured' | 'price-asc' | 'price-desc' | 'rating' | 'newest'>('featured');
  
  // Calculate dynamic highest price from available products
  const maxPossiblePrice = React.useMemo(() => {
    if (products.length === 0) return 1000;
    const highest = Math.max(...products.map((p) => Number(p.Price) || 0));
    return Math.ceil(Math.max(highest + 50, 500));
  }, [products]);

  const [maxPrice, setMaxPrice] = React.useState<number>(1000);

  // Update maxPrice whenever maxPossiblePrice updates if initial
  React.useEffect(() => {
    setMaxPrice((prev) => (prev < maxPossiblePrice ? maxPossiblePrice : prev));
  }, [maxPossiblePrice]);

  // Approved sellers for storefront view
  const approvedSellerIds = React.useMemo(() => {
    const set = new Set<string>();
    sellers.forEach((s) => {
      if (!s.Status || s.Status.toLowerCase() === 'approved') {
        set.add(s.Seller_ID);
      }
    });
    return set;
  }, [sellers]);

  // Compute average ratings map for sorting
  const ratingMap = React.useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      const prodRevs = reviews.filter((r) => r.Product_ID === p.Product_ID);
      const avg = prodRevs.length > 0 ? prodRevs.reduce((sum, r) => sum + r.Rating, 0) / prodRevs.length : 0;
      map.set(p.Product_ID, avg);
    });
    return map;
  }, [products, reviews]);

  const filteredProducts = React.useMemo(() => {
    const list = products.filter((p) => {
      if (sellers.length > 0 && p.Seller_ID && approvedSellerIds.size > 0) {
        if (!approvedSellerIds.has(p.Seller_ID)) return false;
      }
      if (p.Product_Status && p.Product_Status.toLowerCase() === 'deactivated') return false;
      if (selectedCategory !== 'all' && p.Category_ID !== selectedCategory) return false;
      if (stockFilter === 'inStock' && Number(p.Stock) <= 0) return false;
      if (Number(p.Price) > maxPrice) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (p.Name || '').toLowerCase().includes(q);
        const matchDesc = (p.Description || '').toLowerCase().includes(q);
        const cat = categories.find((c) => c.Category_ID === p.Category_ID);
        const matchCat = cat ? cat.Name.toLowerCase().includes(q) : false;
        const sel = sellers.find((s) => s.Seller_ID === p.Seller_ID);
        const matchSel = sel ? sel.Name.toLowerCase().includes(q) : false;
        return matchName || matchDesc || matchCat || matchSel;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === 'price-asc') return Number(a.Price) - Number(b.Price);
      if (sortBy === 'price-desc') return Number(b.Price) - Number(a.Price);
      if (sortBy === 'rating') return (ratingMap.get(b.Product_ID) || 0) - (ratingMap.get(a.Product_ID) || 0);
      if (sortBy === 'newest') return b.Product_ID.localeCompare(a.Product_ID);
      return 0;
    });
  }, [products, sellers, approvedSellerIds, selectedCategory, stockFilter, maxPrice, searchQuery, categories, sortBy, ratingMap]);

  return (
    <div className="space-y-8 pb-16 text-slate-900 dark:text-zinc-100">
      {/* Search & Hero Banner matching the landing page theme */}
      <div className="text-white rounded-[32px] p-6 md:p-8 border border-[#d0c8a5]/20 shadow-[0_36px_80px_rgba(9,9,7,0.42)] relative overflow-hidden bg-[radial-gradient(circle_at_20%_15%,rgba(208,200,165,0.22),transparent_18%),radial-gradient(circle_at_82%_12%,rgba(119,119,90,0.5),transparent_22%),linear-gradient(135deg,#77775a_0%,#514c38_23%,#292820_52%,#11110f_100%)]">
        {/* Soft atmospheric glow */}
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-950/80 border border-sky-800/60 text-sky-300 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            <span>VERIFIED MERCHANTS &amp; DIRECT CHECKOUT</span>
          </div>

          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Curated goods.{' '}
              <span className="italic font-serif font-normal text-sky-400">
                Delivered with care.
              </span>
            </h1>
            <p className="text-zinc-400 text-xs md:text-sm mt-2 leading-relaxed">
              Explore authentic merchandise across categories with real-time stock levels, verified reviews, and instant order tracking.
            </p>
          </div>

          {/* Search Bar matching Landing Page Radar Search */}
          <div className="relative">
            <Search className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by title, specs, category, or merchant..."
              className="w-full pl-12 pr-10 py-3 bg-[#181F2A] border border-zinc-700 rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category Pills & Sub-filters */}
      <div className="space-y-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none max-w-full">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'premium-button text-white shadow-[0_12px_25px_rgba(235,127,45,0.32)]'
                : 'bg-white/10 text-white/85 hover:bg-white/15 border border-white/10'
            }`}
          >
            All Categories ({products.filter((p) => p.Product_Status !== 'deactivated').length})
          </button>
          {categories.map((cat) => {
            const count = products.filter(
              (p) => p.Category_ID === cat.Category_ID && p.Product_Status !== 'deactivated'
            ).length;
            return (
              <button
                key={cat.Category_ID}
                onClick={() => setSelectedCategory(cat.Category_ID)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.Category_ID
                    ? 'premium-button text-white shadow-[0_12px_25px_rgba(235,127,45,0.32)]'
                    : 'bg-white/10 text-white/85 hover:bg-white/15 border border-white/10'
                }`}
              >
                {cat.Name} ({count})
              </button>
            );
          })}
        </div>

        {/* Filter Toolbar: Sort & Price & Stock */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#12161D] p-3.5 rounded-2xl border border-sky-100 dark:border-zinc-800 shadow-xs">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
              <span className="text-slate-600 dark:text-zinc-400 font-medium">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="featured">Featured / Default</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
                <option value="newest">Newest Listed</option>
              </select>
            </div>

            {/* Price Slider */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-zinc-800">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
              <span className="text-slate-600 dark:text-zinc-400 font-medium">Max:</span>
              <span className="font-bold text-blue-600 dark:text-sky-400">{formatCurrency(maxPrice)}</span>
              <input
                type="range"
                min={20}
                max={maxPossiblePrice}
                step={10}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-24 md:w-32 accent-blue-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {/* Stock Toggle */}
            <button
              onClick={() => setStockFilter(stockFilter === 'all' ? 'inStock' : 'all')}
              className={`px-3 py-1.5 rounded-full font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                stockFilter === 'inStock'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'bg-slate-100 dark:bg-[#181F2A] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {stockFilter === 'inStock' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>In Stock Only</span>
                </>
              ) : (
                <span>All Stock</span>
              )}
            </button>

            {/* Reset Filters button if any filter active */}
            {(selectedCategory !== 'all' || searchQuery !== '' || stockFilter !== 'all' || maxPrice < maxPossiblePrice) && (
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchQuery('');
                  setMaxPrice(maxPossiblePrice);
                  setStockFilter('all');
                  setSortBy('featured');
                }}
                className="px-3 py-1.5 rounded-full text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors font-medium cursor-pointer"
                title="Reset all filters"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Schema-Powered Top Charts, Top Sellers, and Trending Products */}
      <MarketplaceTrendsTopCharts
        allProducts={products}
        onSelectProduct={onSelectProduct}
        onAddToCart={onAddToCart}
      />

      {/* Product Grid Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            {selectedCategory === 'all' ? 'All Catalog Products' : `${categories.find((c) => c.Category_ID === selectedCategory)?.Name || 'Category'} Catalog`}
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Showing {filteredProducts.length} verified listings
          </p>
        </div>
      </div>

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#12161D] rounded-3xl border border-sky-100 dark:border-zinc-800 p-8 space-y-4 shadow-xl">
          <div className="w-16 h-16 bg-slate-100 dark:bg-[#181F2A] rounded-2xl flex items-center justify-center mx-auto text-slate-400 dark:text-zinc-500">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No products found</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
            Try adjusting your search query, price filter, or selecting another category.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
              setMaxPrice(maxPossiblePrice);
              setStockFilter('all');
              setSortBy('featured');
            }}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-xs font-bold shadow-md shadow-blue-600/30 transition-all cursor-pointer"
          >
            Reset Catalog Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((prod) => (
            <ProductCard
              key={prod.Product_ID}
              product={prod}
              category={categories.find((c) => c.Category_ID === prod.Category_ID)}
              seller={sellers.find((s) => s.Seller_ID === prod.Seller_ID)}
              reviews={reviews}
              onSelect={onSelectProduct}
              onAddToCart={(p, e) => {
                e.stopPropagation();
                onAddToCart(p, 1);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
