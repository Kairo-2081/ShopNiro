import React from 'react';
import { Product, Category, Seller, ProductStatus } from '../../types';
import { X, Package, Save } from 'lucide-react';

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
  const [description, setDescription] = React.useState('');
  const [price, setPrice] = React.useState<number | ''>('');
  const [voucher, setVoucher] = React.useState('');
  const [stock, setStock] = React.useState<number | ''>('');
  const [categoryId, setCategoryId] = React.useState('');
  const [status, setStatus] = React.useState<ProductStatus>('active');
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setError(null);
    if (productToEdit) {
      setName(productToEdit.Name);
      setImage(productToEdit.Image);
      setDescription(productToEdit.Description);
      setPrice(productToEdit.Price);
      setVoucher(productToEdit.Voucher || '');
      setStock(productToEdit.Stock);
      setCategoryId(productToEdit.Category_ID);
      setStatus(productToEdit.Product_Status);
    } else {
      setName('');
      setImage('https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80');
      setDescription('');
      setPrice(99.0);
      setVoucher('');
      setStock(15);
      setCategoryId(categories[0]?.Category_ID || 'CAT-1');
      setStatus('active');
    }
  }, [productToEdit, categories, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || price === '' || !categoryId) {
      setError('Please fill out all required fields.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSaveProduct({
        Product_ID: productToEdit ? productToEdit.Product_ID : undefined,
        Name: name,
        Image: image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',
        Description: description,
        Price: Number(price),
        Voucher: voucher,
        Stock: Number(stock) || 0,
        Category_ID: categoryId,
        Seller_ID: currentSeller.Seller_ID,
        Product_Status: status,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    } finally {
      setIsSaving(false);
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
              <p className="text-xs text-slate-500 dark:text-zinc-400">Publish catalog items on GoCart marketplace</p>
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
                step="1"
                required
                min="0.01"
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

          <div>
            <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
              Product Image URL
            </label>
            <input
              type="url"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full p-2.5 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed specs and key features..."
              className="w-full p-2.5 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500"
            />
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
