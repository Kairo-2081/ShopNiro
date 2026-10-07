import React from 'react';
import { Product, Category, Seller, ProductStatus, SizeChartMeasurement } from '../../types';
import { api } from '../../lib/api';
import { describeVoucher } from '../../lib/vouchers';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { X, Package, Save, Sparkles, Plus, Trash2 } from 'lucide-react';
const toLocalDateTimeInput = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

type ProductCopyField = 'description' | 'warranty' | 'guarantee' | 'return-policy';

const parseCoverageInformation = (value: string) => {
  const coverage = { warranty: '', guarantee: '' };
  let currentCoverage: keyof typeof coverage | null = null;
  let hasCoverageLabels = false;

  value.split('\n').forEach((line) => {
    const warrantyMatch = line.match(/^Warranty:\s*(.*)$/i);
    const guaranteeMatch = line.match(/^Guarantee:\s*(.*)$/i);
    if (warrantyMatch) {
      currentCoverage = 'warranty';
      hasCoverageLabels = true;
      coverage.warranty = warrantyMatch[1];
    } else if (guaranteeMatch) {
      currentCoverage = 'guarantee';
      hasCoverageLabels = true;
      coverage.guarantee = guaranteeMatch[1];
    } else if (currentCoverage) {
      coverage[currentCoverage] = [coverage[currentCoverage], line].filter(Boolean).join('\n');
    }
  });

  if (!hasCoverageLabels && value.trim()) coverage.warranty = value;
  return coverage;
};

const serializeCoverageInformation = (warranty: string, guarantee: string) => [
  warranty.trim() ? `Warranty: ${warranty.trim()}` : '',
  guarantee.trim() ? `Guarantee: ${guarantee.trim()}` : '',
].filter(Boolean).join('\n');

const measureImageWidth = (url: string) => new Promise<number>((resolve, reject) => {
  const imageElement = new window.Image();
  const timeout = window.setTimeout(() => reject(new Error('Image validation timed out. Check the image URL and try again.')), 10000);
  imageElement.onload = () => {
    window.clearTimeout(timeout);
    resolve(imageElement.naturalWidth);
  };
  imageElement.onerror = () => {
    window.clearTimeout(timeout);
    reject(new Error('An image could not be loaded. Check the URL and try again.'));
  };
  imageElement.src = url;
});

const measureVideoDuration = (url: string) => new Promise<number>((resolve, reject) => {
  const videoElement = document.createElement('video');
  videoElement.preload = 'metadata';
  const timeout = window.setTimeout(() => reject(new Error('Video validation timed out. Check the video URL and try again.')), 10000);
  videoElement.onloadedmetadata = () => {
    window.clearTimeout(timeout);
    resolve(videoElement.duration);
    videoElement.removeAttribute('src');
    videoElement.load();
  };
  videoElement.onerror = () => {
    window.clearTimeout(timeout);
    reject(new Error('The video could not be loaded. Use a direct video URL and try again.'));
  };
  videoElement.src = url;
  videoElement.load();
});

interface SellerProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit: Product | null;
  categories: Category[];
  currentSeller: Seller;
  onSaveProduct: (data: Partial<Product>) => Promise<void>;
}

export const SellerProductModal: React.FC<SellerProductModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  categories,
  currentSeller,
  onSaveProduct,
}) => {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);
  const [name, setName] = React.useState('');
  const [image, setImage] = React.useState('');
  const [videoUrl, setVideoUrl] = React.useState('');
  const [additionalImages, setAdditionalImages] = React.useState<string[]>([]);
  const [highlights, setHighlights] = React.useState<string[]>([]);
  const [description, setDescription] = React.useState('');
  const [warrantyInformation, setWarrantyInformation] = React.useState('');
  const [guaranteeInformation, setGuaranteeInformation] = React.useState('');
  const [warrantyEnabled, setWarrantyEnabled] = React.useState(false);
  const [guaranteeEnabled, setGuaranteeEnabled] = React.useState(false);
  const [returnPolicy, setReturnPolicy] = React.useState('');
  const [price, setPrice] = React.useState<number | ''>('');
    const [voucherExpiresAt, setVoucherExpiresAt] = React.useState('');
    const [featuredDeal, setFeaturedDeal] = React.useState(false);
  const [voucher, setVoucher] = React.useState('');
  const [stock, setStock] = React.useState<number | ''>('');
  const [categoryId, setCategoryId] = React.useState('');
  const [hasSizes, setHasSizes] = React.useState(false);
  const [sizeGender, setSizeGender] = React.useState<'men' | 'women' | 'unisex'>('unisex');
  const [sizes, setSizes] = React.useState<string[]>([]);
  const [sizeChart, setSizeChart] = React.useState<SizeChartMeasurement[]>([]);
  const [isGeneratingSizeChart, setIsGeneratingSizeChart] = React.useState(false);
  const [sizeError, setSizeError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<ProductStatus>('active');
  const [isSaving, setIsSaving] = React.useState(false);
  const [aiCopyLoading, setAiCopyLoading] = React.useState<Record<ProductCopyField, boolean>>({
    description: false,
    warranty: false,
    guarantee: false,
    'return-policy': false,
  });
  const [aiCopyErrors, setAiCopyErrors] = React.useState<Record<ProductCopyField, string | null>>({
    description: null,
    warranty: null,
    guarantee: null,
    'return-policy': null,
  });
  const [aiStyleIndices, setAiStyleIndices] = React.useState<Record<ProductCopyField, number>>({
    description: 0,
    warranty: 0,
    guarantee: 0,
    'return-policy': 0,
  });
  const [error, setError] = React.useState<string | null>(null);
  const selectedCategoryName = categories.find((category) => category.Category_ID === categoryId)?.Name || '';
  const promotionContext = `${selectedCategoryName} ${name}`.toLowerCase();
  const voucherSuggestions = [
    { code: 'SAVE20', matches: /audio|headphone|earbud|headset/.test(promotionContext) },
    { code: 'TECH10', matches: /electronic|gadget|wearable|smart watch|tech/.test(promotionContext) },
    { code: 'BREW15', matches: /coffee|brew|home|living|kitchen|dripper/.test(promotionContext) },
    { code: 'NEW20', matches: /apparel|fashion|clothing|hoodie|kurta|shirt|dress/.test(promotionContext) },
  ].filter((suggestion) => suggestion.matches);

  React.useEffect(() => {
    setError(null);
    if (productToEdit) {
      setName(productToEdit.Name);
      setImage(productToEdit.Images?.[0] || productToEdit.Image);
      setVideoUrl(productToEdit.Video_URL || '');
      setAdditionalImages(productToEdit.Images?.slice(1) || []);
      setHighlights(productToEdit.Highlights || []);
      setDescription(productToEdit.Description);
      const coverage = parseCoverageInformation(productToEdit.Warranty_Information || '');
      setWarrantyInformation(coverage.warranty);
      setGuaranteeInformation(coverage.guarantee);
      setWarrantyEnabled(Boolean(coverage.warranty));
      setGuaranteeEnabled(Boolean(coverage.guarantee));
      setReturnPolicy(productToEdit.Return_Policy || '');
      setPrice(productToEdit.Price);
        setVoucherExpiresAt(toLocalDateTimeInput(productToEdit.Voucher_Expires_At));
        setFeaturedDeal(Boolean(productToEdit.Featured_Deal));
      setVoucher(productToEdit.Voucher || '');
      setStock(productToEdit.Stock);
      setCategoryId(productToEdit.Category_ID);
      setStatus(productToEdit.Product_Status);
      setHasSizes(Boolean(productToEdit.Sizes?.length));
      setSizeGender(productToEdit.Size_Gender || 'unisex');
      setSizes(productToEdit.Sizes || []);
      setSizeChart(productToEdit.Size_Chart || []);
    } else {
      setName('');
      setImage('https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&auto=format&fit=crop&q=80');
      setVideoUrl('');
      setAdditionalImages([]);
      setHighlights([]);
      setDescription('');
      setWarrantyInformation('');
      setGuaranteeInformation('');
      setWarrantyEnabled(false);
      setGuaranteeEnabled(false);
      setReturnPolicy('');
      setPrice(99.0);
        setVoucherExpiresAt('');
        setFeaturedDeal(false);
      setVoucher('');
      setStock(15);
      const initialCategoryId = categories[0]?.Category_ID || 'CAT-1';
      const initialCategoryName = categories.find((category) => category.Category_ID === initialCategoryId)?.Name || '';
      const categoryHasSizes = /apparel|fashion|clothing|dress/i.test(initialCategoryName);
      setCategoryId(initialCategoryId);
      setStatus('active');
      setHasSizes(categoryHasSizes);
      setSizeGender('unisex');
      setSizes(categoryHasSizes ? ['S', 'M', 'L', 'XL'] : []);
      setSizeChart([]);
    }
    setSizeError(null);
    setAiCopyErrors({ description: null, warranty: null, guarantee: null, 'return-policy': null });
  }, [productToEdit, categories, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || price === '' || !categoryId) {
      setError('Please fill out all required fields.');
      return;
    }
    if (name.trim().length > 80) {
      setError('Keep the product title within 80 characters.');
      return;
    }
    if (description.trim().split(/\s+/).filter(Boolean).length > 300) {
      setError('Keep the product description within 300 words.');
      return;
    }
    const imageUrls = [image, ...additionalImages].map((url) => url.trim()).filter(Boolean);
    if (imageUrls.length < 1 || imageUrls.length > 7) {
      setError('Add at least one product image, with no more than seven.');
      return;
    }
    if (hasSizes && sizes.length === 0) {
      setError('Choose at least one available size.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const imageWidths = await Promise.all(imageUrls.map(measureImageWidth));
      const lowResolutionIndex = imageWidths.findIndex((width) => width < 1200);
      if (lowResolutionIndex >= 0) {
        setError(`Image ${lowResolutionIndex + 1} must be at least 1200px wide.`);
        return;
      }
      if (videoUrl.trim() && await measureVideoDuration(videoUrl.trim()) > 15) {
        setError('Product videos must be 15 seconds or shorter.');
        return;
      }
      await onSaveProduct({
        Product_ID: productToEdit ? productToEdit.Product_ID : undefined,
        Name: name,
        Image: image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',
        Video_URL: videoUrl.trim(),
        Images: [image, ...additionalImages].map((url) => url.trim()).filter(Boolean),
        Highlights: highlights.map((highlight) => highlight.trim()).filter(Boolean),
        Description: description,
        Warranty_Information: serializeCoverageInformation(
          warrantyEnabled ? warrantyInformation : '',
          guaranteeEnabled ? guaranteeInformation : ''
        ),
        Return_Policy: returnPolicy,
        Price: Number(price),
          Voucher_Expires_At: voucherExpiresAt ? new Date(voucherExpiresAt).toISOString() : null,
          Featured_Deal: Boolean(voucher.trim() && featuredDeal),
        Voucher: voucher,
        Stock: Number(stock) || 0,
        Category_ID: categoryId,
        Seller_ID: currentSeller.Seller_ID,
        Product_Status: status,
        Size_Gender: hasSizes ? sizeGender : undefined,
        Sizes: hasSizes ? sizes : [],
        Size_Chart: hasSizes ? sizeChart : [],
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSize = (size: string) => {
    setSizes((current) => {
      const next = current.includes(size) ? current.filter((item) => item !== size) : [...current, size];
      setSizeChart((chart) => chart.filter((row) => next.includes(row.Size)));
      return next;
    });
  };

  const updateMeasurement = (size: string, field: keyof Omit<SizeChartMeasurement, 'Size'>, value: string) => {
    setSizeChart((current) => {
      const existing = current.find((row) => row.Size === size) || { Size: size };
      const numericValue = value === '' ? undefined : Number(value);
      const updated = { ...existing, [field]: numericValue };
      return [...current.filter((row) => row.Size !== size), updated].sort((a, b) => sizes.indexOf(a.Size) - sizes.indexOf(b.Size));
    });
  };

  const handleGenerateSizeChart = async () => {
    if (!name.trim() || !image.trim()) {
      setSizeError('Enter a product name and image URL before generating a size chart.');
      return;
    }
    setIsGeneratingSizeChart(true);
    setSizeError(null);
    try {
      const selectedCategory = categories.find((category) => category.Category_ID === categoryId);
      const result = await api.generateAISizeChart({
        productName: name.trim(),
        categoryName: selectedCategory?.Name,
        gender: sizeGender,
        imageUrl: image.trim(),
      });
      setSizes(result.sizes);
      setSizeChart(result.sizeChart);
    } catch (err: any) {
      setSizeError(err.message || 'Could not generate the size chart. Add sizes manually.');
    } finally {
      setIsGeneratingSizeChart(false);
    }
  };

  const handleAICopy = async (field: ProductCopyField) => {
    if (!name.trim()) {
      setAiCopyErrors((current) => ({ ...current, [field]: 'Enter a product title first.' }));
      return;
    }

    const sourceText = field === 'description'
      ? description
      : field === 'warranty'
      ? warrantyInformation
      : field === 'guarantee'
      ? guaranteeInformation
      : returnPolicy;
    const styleIndex = aiStyleIndices[field];
    setAiCopyLoading((current) => ({ ...current, [field]: true }));
    setAiCopyErrors((current) => ({ ...current, [field]: null }));
    setAiStyleIndices((current) => ({ ...current, [field]: (current[field] + 1) % 3 }));
    try {
      const result = await api.generateAIProductCopy({
        field,
        shopName: currentSeller.Name,
        productName: name.trim(),
        categoryName: selectedCategoryName,
        productFacts: highlights.map((highlight) => highlight.trim()).filter(Boolean),
        sourceText: sourceText.trim(),
        styleIndex,
      });
      if (field === 'description') setDescription(result.copy);
      else if (field === 'warranty') setWarrantyInformation(result.copy);
      else if (field === 'guarantee') setGuaranteeInformation(result.copy);
      else setReturnPolicy(result.copy);
    } catch (err: any) {
      setAiCopyErrors((current) => ({ ...current, [field]: err.message || 'Could not prepare product copy. Please try again.' }));
    } finally {
      setAiCopyLoading((current) => ({ ...current, [field]: false }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="seller-product-modal-title" tabIndex={-1} className="premium-surface w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-6">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-sky-100 dark:border-zinc-800/80 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 id="seller-product-modal-title" className="font-bold text-slate-900 dark:text-white text-base">
                {productToEdit ? 'Edit Product Listing' : 'Create New Product Listing'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Publish catalog items on ShopNiro marketplace</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close product editor"
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d0c8a5]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-2xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
              Product Title *
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wireless Noise-Canceling Headphones"
              className="w-full p-2.5 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500"
            />
            <div className="mt-1 flex justify-between gap-3 text-[10px] text-slate-500 dark:text-zinc-400">
              <span>Lead with the brand, model, and main feature.</span>
              <span className="shrink-0 tabular-nums">{name.length}/80</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                Category *
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              >
                {categories.map((c) => (
                  <option key={c.Category_ID} value={c.Category_ID}>
                    {c.Name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                Product Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductStatus)}
                className="w-full p-2.5 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              >
                <option value="active">Active (Visible)</option>
                <option value="inactive">Inactive (Hidden)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                Unit Price (৳) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="0.01"
                max="99999999.99"
                value={price}
                onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              />
              <p className="mt-1 text-[10px] text-slate-500 dark:text-zinc-400">Whole-number and decimal prices are accepted.</p>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                Stock Quantity *
              </label>
              <input
                type="number"
                required
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
                Voucher Code (Optional)
              </label>
              <input
                type="text"
                value={voucher}
                onChange={(e) => setVoucher(e.target.value)}
                placeholder="e.g. SAVE10"
                className="w-full p-2.5 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white uppercase"
              />
              <p className="mt-1 text-[10px] text-slate-500 dark:text-zinc-400">Campaigns discount matching products at checkout; TECH10 is a flat ৳10 per item.</p>
              {voucherSuggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {voucherSuggestions.map(({ code }) => (
                    <button key={code} type="button" onClick={() => setVoucher(code)} aria-pressed={voucher === code} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${voucher === code ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}>
                      {code} · {describeVoucher(code)}
                    </button>
                  ))}
                </div>
              )}
              <label className="mt-2 block text-[10px] font-semibold text-slate-600 dark:text-zinc-300">
                Offer end date
                <input type="datetime-local" value={voucherExpiresAt} onChange={(event) => setVoucherExpiresAt(event.target.value)} disabled={!voucher.trim()} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-[#181F2A] dark:text-white" />
              </label>
              <label className="mt-2 flex items-center gap-2 text-[10px] font-semibold text-slate-600 dark:text-zinc-300">
                <input type="checkbox" checked={featuredDeal} onChange={(event) => setFeaturedDeal(event.target.checked)} disabled={!voucher.trim()} />
                Show in Featured Deals
              </label>
            </div>
          </div>

          <section className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <label className="block text-slate-700 dark:text-zinc-300 font-semibold">Product Image URLs</label>
              <span className="shrink-0 text-[10px] tabular-nums text-slate-500 dark:text-zinc-400">
                {[image, ...additionalImages].filter((url) => url.trim()).length}/7
              </span>
            </div>
            <input
              type="url"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="Primary image URL"
              className="w-full p-2.5 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500"
            />
            {additionalImages.map((url, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setAdditionalImages((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                  placeholder={`Additional image ${index + 2} URL`}
                  className="min-w-0 flex-1 p-2.5 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500"
                />
                <button type="button" onClick={() => setAdditionalImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove image ${index + 2}`} className="rounded-lg border border-slate-300 px-3 text-slate-500 hover:text-rose-600 dark:border-zinc-700"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] text-slate-500 dark:text-zinc-400">Add 1–7 clear product views. Each image must be at least 1200 px wide.</p>
              <button type="button" disabled={[image, ...additionalImages].filter((url) => url.trim()).length >= 7} onClick={() => setAdditionalImages((current) => [...current, ''])} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300"><Plus className="h-3.5 w-3.5" />Add image</button>
            </div>
          </section>

          <div>
            <label htmlFor="seller-product-video" className="mb-1 block text-xs font-semibold text-slate-700 dark:text-zinc-300">Product video URL · 15 seconds max</label>
            <input id="seller-product-video" type="url" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://example.com/product-demo.mp4" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-[#181F2A] dark:text-white" />
          </div>

          <section className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200">Key product specs</h3>
                <p className="mt-0.5 text-[10px] text-slate-500 dark:text-zinc-400">Add up to 5 concise benefits or specifications.</p>
              </div>
              <span className="text-[10px] tabular-nums text-slate-500 dark:text-zinc-400">{highlights.filter(Boolean).length}/5</span>
            </div>
            {highlights.map((highlight, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  maxLength={120}
                  value={highlight}
                  onChange={(event) => setHighlights((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                  placeholder={`Key spec ${index + 1}`}
                  aria-label={`Key product spec ${index + 1}`}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-[#181F2A] dark:text-white"
                />
                <button type="button" onClick={() => setHighlights((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove key spec ${index + 1}`} className="rounded-lg border border-slate-300 px-3 text-slate-500 hover:text-rose-600 dark:border-zinc-700"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            {highlights.length < 5 && (
              <button type="button" onClick={() => setHighlights((current) => [...current, ''])} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
                <Plus className="h-3.5 w-3.5" />Add spec
              </button>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-zinc-200">
              <input type="checkbox" checked={hasSizes} onChange={(event) => { setHasSizes(event.target.checked); setSizeError(null); }} />
              This apparel product has size options
            </label>
            {hasSizes && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Size group
                    <select value={sizeGender} onChange={(event) => setSizeGender(event.target.value as 'men' | 'women' | 'unisex')} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-[#181F2A]">
                      <option value="men">Men</option><option value="women">Women</option><option value="unisex">Unisex</option>
                    </select>
                  </label>
                  <button type="button" onClick={handleGenerateSizeChart} disabled={isGeneratingSizeChart} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30">
                    <Sparkles className="h-3.5 w-3.5" />{isGeneratingSizeChart ? 'Reading image...' : 'Suggest size chart from image'}
                  </button>
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">AI measurements are visual estimates. Verify them against the actual garment before publishing.</p>
                <div className="flex flex-wrap gap-2">
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map((size) => (
                    <button key={size} type="button" aria-pressed={sizes.includes(size)} onClick={() => toggleSize(size)} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${sizes.includes(size) ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 text-slate-700 dark:border-zinc-700 dark:text-zinc-300'}`}>{size}</button>
                  ))}
                </div>
                {sizes.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[540px] text-left text-xs">
                      <thead className="text-slate-500 dark:text-zinc-400"><tr><th className="py-2">Size</th><th>Chest cm</th><th>Waist cm</th><th>Hip cm</th><th>Length cm</th></tr></thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                        {sizes.map((size) => {
                          const row = sizeChart.find((measurement) => measurement.Size === size);
                          return <tr key={size}><td className="py-2 font-bold text-slate-800 dark:text-zinc-200">{size}</td>{(['Chest_CM', 'Waist_CM', 'Hip_CM', 'Length_CM'] as const).map((field) => <td key={field} className="py-1"><input aria-label={`${size} ${field.replace('_CM', '').toLowerCase()} centimeters`} type="number" min="0" step="0.1" value={row?.[field] ?? ''} onChange={(event) => updateMeasurement(size, field, event.target.value)} className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-[#181F2A]" /></td>)}</tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {sizeError && <p role="alert" className="text-xs text-rose-600 dark:text-rose-300">{sizeError}</p>}
              </div>
            )}
          </section>

          <div>
            <div className="flex items-center justify-between gap-3 mb-1">
              <label className="block text-slate-700 dark:text-zinc-300 font-semibold">Product description · up to 300 words</label>
              <button
                type="button"
                onClick={() => void handleAICopy('description')}
                disabled={aiCopyLoading.description}
                className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold hover:text-emerald-800 dark:hover:text-emerald-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {aiCopyLoading.description ? 'Working...' : description.trim() ? 'Enhance with AI' : 'Draft with AI'}
              </button>
            </div>
            <textarea
              rows={3}
              maxLength={2200}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setAiCopyErrors((current) => ({ ...current, description: null }));
              }}
              placeholder={'## Highlights\n**Benefit one:** ...\n**Benefit two:** ...\n\n## Specifications\n- ...'}
              className="w-full p-2.5 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500"
            />
            <p className="mt-1 text-[10px] text-slate-500 dark:text-zinc-400">AI uses your entered product specs to write polished, detailed copy. Verify every claim before publishing.</p>
            <p className="mt-1 text-right text-[10px] tabular-nums text-slate-500 dark:text-zinc-400">
              {description.trim() ? description.trim().split(/\s+/).filter(Boolean).length : 0}/300 words
            </p>
            {aiCopyErrors.description && <p role="alert" className="mt-1 text-rose-600 dark:text-rose-300">{aiCopyErrors.description}</p>}
          </div>

          <section className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200">Warranty and guarantee</h3>
              <p className="mt-1 text-[10px] text-slate-500 dark:text-zinc-400">Choose the coverage offered. AI drafts use editable placeholders when no terms are provided.</p>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <input type="checkbox" checked={warrantyEnabled} onChange={(event) => setWarrantyEnabled(event.target.checked)} />
                Warranty
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-zinc-300">
                <input type="checkbox" checked={guaranteeEnabled} onChange={(event) => setGuaranteeEnabled(event.target.checked)} />
                Guarantee
              </label>
            </div>
            {warrantyEnabled && (
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label htmlFor="seller-warranty-info" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Warranty terms · seller verified</label>
                  <button type="button" onClick={() => void handleAICopy('warranty')} disabled={aiCopyLoading.warranty} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50 dark:text-emerald-300"><Sparkles className="h-3.5 w-3.5" />{aiCopyLoading.warranty ? 'Working...' : warrantyInformation.trim() ? 'Enhance with AI' : 'Draft with AI'}</button>
                </div>
                <textarea id="seller-warranty-info" rows={4} maxLength={2200} value={warrantyInformation} onChange={(event) => { setWarrantyInformation(event.target.value); setAiCopyErrors((current) => ({ ...current, warranty: null })); }} placeholder="Enter verified warranty coverage and duration." className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-[#181F2A] dark:text-white" />
                {aiCopyErrors.warranty && <p role="alert" className="mt-1 text-rose-600 dark:text-rose-300">{aiCopyErrors.warranty}</p>}
              </div>
            )}
            {guaranteeEnabled && (
              <div>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <label htmlFor="seller-guarantee-info" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Guarantee terms · seller verified</label>
                  <button type="button" onClick={() => void handleAICopy('guarantee')} disabled={aiCopyLoading.guarantee} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50 dark:text-emerald-300"><Sparkles className="h-3.5 w-3.5" />{aiCopyLoading.guarantee ? 'Working...' : guaranteeInformation.trim() ? 'Enhance with AI' : 'Draft with AI'}</button>
                </div>
                <textarea id="seller-guarantee-info" rows={4} maxLength={2200} value={guaranteeInformation} onChange={(event) => { setGuaranteeInformation(event.target.value); setAiCopyErrors((current) => ({ ...current, guarantee: null })); }} placeholder="Enter verified guarantee conditions and duration." className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-[#181F2A] dark:text-white" />
                {aiCopyErrors.guarantee && <p role="alert" className="mt-1 text-rose-600 dark:text-rose-300">{aiCopyErrors.guarantee}</p>}
              </div>
            )}
          </section>

          <section>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label htmlFor="seller-return-policy" className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">Return terms · seller provided</label>
              <button type="button" onClick={() => void handleAICopy('return-policy')} disabled={aiCopyLoading['return-policy']} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50 dark:text-emerald-300"><Sparkles className="h-3.5 w-3.5" />{aiCopyLoading['return-policy'] ? 'Working...' : returnPolicy.trim() ? 'Enhance with AI' : 'Draft with AI'}</button>
            </div>
            <textarea id="seller-return-policy" rows={4} maxLength={2200} value={returnPolicy} onChange={(event) => { setReturnPolicy(event.target.value); setAiCopyErrors((current) => ({ ...current, 'return-policy': null })); }} placeholder="State return conditions, or leave blank." className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-[#181F2A] dark:text-white" />
            {aiCopyErrors['return-policy'] && <p role="alert" className="mt-1 text-rose-600 dark:text-rose-300">{aiCopyErrors['return-policy']}</p>}
          </section>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-full shadow-lg shadow-emerald-500/30 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
