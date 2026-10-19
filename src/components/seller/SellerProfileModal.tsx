import React from 'react';
import { Address, Seller } from '../../types';
import { AccountLocationPicker } from '../AccountLocationPicker';
import { FileText, MapPin, X } from 'lucide-react';

interface SellerProfileModalProps {
  seller: Seller;
  onClose: () => void;
  onSave: (updates: Partial<Seller> & { Identity_Document?: string; Identity_Document_File_Name?: string }) => Promise<void>;
  required?: boolean;
  requireIdentityDocument?: boolean;
}

export const SellerProfileModal: React.FC<SellerProfileModalProps> = ({ seller, onClose, onSave, required = false, requireIdentityDocument = false }) => {
  const [name, setName] = React.useState(seller.Name);
  const [username, setUsername] = React.useState(seller.Username || '');
  const [email, setEmail] = React.useState(seller.Email);
  const [phone, setPhone] = React.useState(seller.Number);
  const [logo, setLogo] = React.useState(seller.Logo);
  const [description, setDescription] = React.useState(seller.Description);
  const [payoutMethod, setPayoutMethod] = React.useState(seller.Payout_Method || '');
  const [payoutAccount, setPayoutAccount] = React.useState(seller.Payout_Account || '');
  const [identityDocument, setIdentityDocument] = React.useState('');
  const [identityDocumentFileName, setIdentityDocumentFileName] = React.useState('');
  const [address, setAddress] = React.useState<Address>(seller.Address);
  const [hasSelectedLocation, setHasSelectedLocation] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleIdentityDocumentChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setError('ID document must be a PDF, JPG, or PNG no larger than 5 MB.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setIdentityDocument(reader.result);
        setIdentityDocumentFileName(file.name);
        setError(null);
      }
    };
    reader.onerror = () => setError('Could not read the ID document. Please try another file.');
    reader.readAsDataURL(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const addressLocationChanged =
      address.Street.trim() !== seller.Address.Street.trim() ||
      address.City.trim() !== seller.Address.City.trim();
    if (
      !address.Street.trim() || !address.City.trim() ||
      !Number.isFinite(address.Latitude) || !Number.isFinite(address.Longitude) ||
      (addressLocationChanged && !hasSelectedLocation)
    ) {
      setError('Choose the updated business location on the map when changing the street or city.');
      return;
    }
    if (required && (!payoutMethod || payoutAccount.trim().length < 6)) {
      setError('Choose a payout method and enter a payout account with at least 6 characters.');
      return;
    }
    if (requireIdentityDocument && !identityDocument) {
      setError('Upload your government ID document to complete the seller profile.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        Name: name.trim(),
        Username: username.trim(),
        Email: email.trim(),
        Number: phone.trim(),
        Logo: logo.trim(),
        Description: description.trim(),
        Payout_Method: payoutMethod,
        Payout_Account: payoutAccount.trim(),
        Address: address,
        Identity_Document: identityDocument || undefined,
        Identity_Document_File_Name: identityDocumentFileName || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Could not update store details.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:border-zinc-700 dark:bg-[#181F2A] dark:text-white';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="seller-profile-title" className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#12161D]">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
          <div><h2 id="seller-profile-title" className="font-bold text-slate-900 dark:text-white">Edit store details</h2><p className="text-xs text-slate-500 dark:text-zinc-400">Changes return the store to admin review.</p></div>
          <button type="button" onClick={onClose} aria-label="Close store details" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
        </header>
        <form onSubmit={submit} className="space-y-4 overflow-y-auto p-5">
          {required && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Complete and save your business profile before making other changes.</p>}
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
          {requireIdentityDocument && (
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-emerald-500 bg-emerald-50/60 p-4 text-sm text-slate-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-zinc-200">
              <FileText className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
              <span className="min-w-0 flex-1">{identityDocumentFileName || 'Upload government ID (PDF, JPG, PNG · max 5 MB)'}</span>
              <input type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={(event) => void handleIdentityDocumentChange(event)} />
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">Store name<input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></label>
            <label className="space-y-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">Username<input required value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} /></label>
            <label className="space-y-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></label>
            <label className="space-y-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">Phone<input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} /></label>
            <label className="space-y-1 text-xs font-semibold text-slate-700 dark:text-zinc-300 sm:col-span-2">Logo URL<input type="url" value={logo} onChange={(e) => setLogo(e.target.value)} className={inputClass} /></label>
          </div>
          <label className="block space-y-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">Store description<textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} /></label>

          <section className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">Payout method{required ? ' *' : ''}
              <select required={required} value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value)} className={inputClass}>
                <option value="">Not set</option>
                <option value="bkash">bKash</option>
                <option value="bank">Bank</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">Payout account{required ? ' *' : ''}
              <input required={required} minLength={required ? 6 : undefined} value={payoutAccount} onChange={(event) => setPayoutAccount(event.target.value)} className={inputClass} />
            </label>
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><MapPin className="h-4 w-4 text-emerald-700" />Business address</h3>
            <AccountLocationPicker onAddressSelected={(selected) => {
              setHasSelectedLocation(Boolean(selected));
              setAddress(selected ? { ...address, ...selected } : { ...address, Street: '', City: '', Latitude: undefined, Longitude: undefined });
            }} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">Building<input required value={address.House_Name} onChange={(e) => setAddress({ ...address, House_Name: e.target.value })} className={inputClass} /></label>
              <label className="space-y-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">Street<input required value={address.Street} onChange={(e) => setAddress({ ...address, Street: e.target.value })} className={inputClass} /></label>
              <label className="space-y-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">City<input required value={address.City} onChange={(e) => setAddress({ ...address, City: e.target.value })} className={inputClass} /></label>
              <label className="space-y-1 text-xs font-semibold text-slate-700 dark:text-zinc-300">Postal code<input value={address.Postal_Code} onChange={(e) => setAddress({ ...address, Postal_Code: e.target.value })} className={inputClass} /></label>
            </div>
          </section>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-zinc-800">
            <p className="text-xs text-amber-700 dark:text-amber-300">Saving any change sets your store to pending until an admin approves it.</p>
            <button type="submit" disabled={isSaving} className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{isSaving ? 'Saving...' : 'Save and request review'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
};