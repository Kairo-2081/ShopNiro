import React from 'react';
import { Product, Category, Seller, ProductStatus, SizeChartMeasurement } from '../../types';
import { api } from '../../lib/api';
import { X, Package, Save, Sparkles, Plus, Trash2 } from 'lucide-react';

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
  const [name, setName] = React.useState('');
  const [image, setImage] = React.useState('');
  const [additionalImages, setAdditionalImages] = React.useState<string[]>([]);
  const [description, setDescription] = React.useState('');
  const [price, setPrice] = React.useState<number | ''>('');
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
  const [isGeneratingDescription, setIsGeneratingDescription] = React.useState(false);
  const [descriptionError, setDescriptionError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setError(null);
    if (productToEdit) {
      setName(productToEdit.Name);
      setImage(productToEdit.Images?.[0] || productToEdit.Image);
      setAdditionalImages(productToEdit.Images?.slice(1) || []);
      setDescription(productToEdit.Description);
      setPrice(productToEdit.Price);
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
      setImage('https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80');
      setAdditionalImages([]);
      setDescription('');
      setPrice(99.0);
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
  }, [productToEdit, categories, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || price === '' || !categoryId) {
      setError('Please fill out all required fields.');
      return;
    }
    if (hasSizes && sizes.length === 0) {
      setError('Choose at least one available size.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSaveProduct({
        Product_ID: productToEdit ? productToEdit.Product_ID : undefined,
        Name: name,
        Image: image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',
        Images: [image, ...additionalImages].map((url) => url.trim()).filter(Boolean),
        Description: description,
        Price: Number(price),
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

  const handleGenerateDescription = async () => {
    if (!name.trim()) {
      setDescriptionError('Enter a product title first.');
      return;
    }

    setIsGeneratingDescription(true);
    setDescriptionError(null);
    try {
      const selectedCategory = categories.find((category) => category.Category_ID === categoryId);
      const result = await api.generateAIDescription({
        kind: 'product',
        shopName: currentSeller.Name,
        productName: name.trim(),
        categoryName: selectedCategory?.Name,
      });
      setDescription(result.description);
    } catch (err: any) {
      setDescriptionError(err.message || 'Could not generate a description. Please try again.');
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#12161D] w-full max-w-2xl rounded-3xl shadow-2xl border border-sky-100 dark:border-sky-500/20 overflow-hidden max-h-[90vh] flex flex-col my-6">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-sky-100 dark:border-zinc-800/80 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-base">
                {productToEdit ? 'Edit Product Listing' : 'Create New Product Listing'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Publish catalog items on ShopNiro marketplace</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wireless Noise-Canceling Headphones"
              className="w-full p-2.5 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500"
            />
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
            </div>
          </div>

          <section className="space-y-2">
            <label className="block text-slate-700 dark:text-zinc-300 font-semibold">Product Image URLs</label>
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
            <button type="button" onClick={() => setAdditionalImages((current) => [...current, ''])} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"><Plus className="h-3.5 w-3.5" />Add another image</button>
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
              <label className="block text-slate-700 dark:text-zinc-300 font-semibold">Description</label>
              <button
                type="button"
                onClick={handleGenerateDescription}
                disabled={isGeneratingDescription}
                className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold hover:text-emerald-800 dark:hover:text-emerald-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isGeneratingDescription ? 'Writing...' : 'Write with AI'}
              </button>
            </div>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDescriptionError(null);
              }}
              placeholder="Detailed specs and key features..."
              className="w-full p-2.5 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500"
            />
            {descriptionError && <p role="alert" className="mt-1 text-rose-600 dark:text-rose-300">{descriptionError}</p>}
          </div>

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
