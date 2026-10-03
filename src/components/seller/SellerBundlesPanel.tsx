import React from 'react';
import { Product, ProductBundle } from '../../types';
import { api, formatCurrency, formatDate } from '../../lib/api';
import { Check, Plus, Tag, Trash2 } from 'lucide-react';

interface SellerBundlesPanelProps {
  products: Product[];
}

const toLocalDateTimeInput = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export const SellerBundlesPanel: React.FC<SellerBundlesPanelProps> = ({ products }) => {
  const [bundles, setBundles] = React.useState<ProductBundle[]>([]);
  const [name, setName] = React.useState('');
  const [productIds, setProductIds] = React.useState<string[]>([]);
  const [discountPercent, setDiscountPercent] = React.useState(5);
  const [endsAt, setEndsAt] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const refreshBundles = async () => {
    try {
      setBundles(await api.getSellerBundles());
      setError('');
    } catch (loadError: any) {
      setError(loadError.message || 'Could not load bundle offers.');
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    void refreshBundles();
  }, []);

  const toggleProduct = (id: string) => {
    setProductIds((current) => current.includes(id)
      ? current.filter((productId) => productId !== id)
      : current.length < 5 ? [...current, id] : current);
  };

  const createBundle = async (event: React.FormEvent) => {
    event.preventDefault();
    if (productIds.length < 2) {
      setError('Choose at least two products for this bundle.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await api.createSellerBundle({
        Name: name.trim(),
        Product_IDs: productIds,
        Discount_Percent: Number(discountPercent),
        Ends_At: endsAt ? new Date(endsAt).toISOString() : undefined,
      });
      setName('');
      setProductIds([]);
      setDiscountPercent(5);
      setEndsAt('');
      await refreshBundles();
    } catch (saveError: any) {
      setError(saveError.message || 'Could not create this bundle.');
    } finally {
      setIsSaving(false);
    }
  };

  const setActive = async (bundle: ProductBundle, Active: boolean) => {
    try {
      const updated = await api.setSellerBundleActive(bundle.Bundle_ID, Active);
      setBundles((current) => current.map((item) => item.Bundle_ID === updated.Bundle_ID ? updated : item));
    } catch (updateError: any) {
      setError(updateError.message || 'Could not update this bundle.');
    }
  };

  const deleteBundle = async (bundle: ProductBundle) => {
    if (!window.confirm(`Delete "${bundle.Name}"?`)) return;
    try {
      await api.deleteSellerBundle(bundle.Bundle_ID);
      setBundles((current) => current.filter((item) => item.Bundle_ID !== bundle.Bundle_ID));
    } catch (deleteError: any) {
      setError(deleteError.message || 'Could not delete this bundle.');
    }
  };

  const selectableProducts = products.filter((product) => product.Product_Status === 'active' && Number(product.Stock) > 0);
  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-zinc-700 dark:bg-[#181F2A] dark:text-white';

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
      <form onSubmit={(event) => void createBundle(event)} className="space-y-4 border-b border-slate-200 pb-6 dark:border-zinc-800 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-6">
        <header>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create a bundle</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">The discount applies when every selected item is in the cart. Bundle savings stack with product vouchers.</p>
        </header>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
        <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">Bundle name<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Home-Office Kit" className={inputClass} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">Extra discount (%)<input required type="number" min="0.01" max="50" step="0.01" value={discountPercent} onChange={(event) => setDiscountPercent(Number(event.target.value))} className={inputClass} /></label>
          <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">Offer ends (optional)<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} min={toLocalDateTimeInput(new Date().toISOString())} className={inputClass} /></label>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Products ({productIds.length}/5)</legend>
          {selectableProducts.length ? selectableProducts.map((product) => (
            <label key={product.Product_ID} className="flex cursor-pointer items-center gap-3 border-b border-slate-100 py-2.5 text-xs dark:border-zinc-800">
              <input type="checkbox" checked={productIds.includes(product.Product_ID)} onChange={() => toggleProduct(product.Product_ID)} disabled={!productIds.includes(product.Product_ID) && productIds.length >= 5} />
              <img src={product.Image} alt="" className="h-9 w-9 rounded-md object-cover" />
              <span className="min-w-0 flex-1 truncate font-semibold text-slate-800 dark:text-zinc-200">{product.Name}</span>
              <span className="shrink-0 tabular-nums text-slate-500">{formatCurrency(product.Price)}</span>
            </label>
          )) : <p className="py-3 text-xs text-slate-500">Add active, in-stock products before creating bundles.</p>}
        </fieldset>
        <button type="submit" disabled={isSaving || productIds.length < 2} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Plus className="h-4 w-4" />{isSaving ? 'Creating…' : 'Create bundle'}</button>
      </form>

      <section className="space-y-3">
        <header className="flex items-center gap-2"><Tag className="h-4 w-4 text-amber-600" /><h2 className="text-lg font-bold text-slate-900 dark:text-white">Your bundles</h2></header>
        {isLoading ? <p className="py-6 text-center text-xs text-slate-500">Loading bundles…</p> : bundles.length ? bundles.map((bundle) => {
          const bundleProducts = bundle.Product_IDs.map((id) => products.find((product) => product.Product_ID === id)).filter(Boolean);
          return (
            <article key={bundle.Bundle_ID} className="border-b border-slate-200 py-3 dark:border-zinc-800">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">{bundle.Name}</h3>
                  <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{bundle.Discount_Percent}% off together</p>
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-zinc-400">{bundleProducts.map((product) => product?.Name).join(' + ') || 'Product no longer listed'}</p>
                  {bundle.Ends_At && <p className="mt-1 text-[10px] text-slate-500 dark:text-zinc-400">Ends {formatDate(bundle.Ends_At)}</p>}
                  {!bundle.Active && <p className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300">Paused</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={() => void setActive(bundle, !bundle.Active)} aria-label={`${bundle.Active ? 'Pause' : 'Activate'} ${bundle.Name}`} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-[10px] font-bold text-slate-700 dark:border-zinc-700 dark:text-zinc-200"><Check className="h-3.5 w-3.5" />{bundle.Active ? 'Pause' : 'Activate'}</button>
                  <button type="button" onClick={() => void deleteBundle(bundle)} aria-label={`Delete ${bundle.Name}`} className="rounded-md border border-slate-300 p-1.5 text-slate-500 hover:text-rose-600 dark:border-zinc-700"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </article>
          );
        }) : <p className="py-8 text-center text-xs text-slate-500">No bundles yet.</p>}
      </section>
    </section>
  );
};
