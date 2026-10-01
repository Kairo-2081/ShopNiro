import React, { useState } from 'react';
import { Seller, Address } from '../../types';
import { api } from '../../lib/api';
import { AccountLocationPicker } from '../AccountLocationPicker';
import { X, Store, Send, MapPin, Lock, Eye, EyeOff, User, Mail, Phone, Image, Sparkles } from 'lucide-react';

interface SellerSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterSeller: (sellerData: Partial<Seller> & { Username?: string }) => Promise<Seller>;
  onSuccessRegistered: (newSeller: Seller) => void;
}

export const SellerSignupModal: React.FC<SellerSignupModalProps> = ({
  isOpen,
  onClose,
  onRegisterSeller,
  onSuccessRegistered,
}) => {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [number, setNumber] = useState('');
  const [hasSelectedLocation, setHasSelectedLocation] = useState(false);
  const [logo, setLogo] = useState('https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=200');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState<Address>({
    Street: '',
    House_Name: '',
    City: '',
    Postal_Code: '',
    Additional_Info: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim() || !number.trim() || !hasSelectedLocation || !address.Street.trim() || !address.City.trim()) {
      setError('Complete the required fields, enter a phone number, and use current location or select a point on the map.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const finalUsername = (username.trim() || name.replace(/[^a-z0-9]/gi, '').toLowerCase() || email.split('@')[0]).toLowerCase();
      const newSeller = await onRegisterSeller({
        Username: finalUsername,
        Name: name.trim(),
        Email: email.trim(),
        Password: password.trim(),
        Number: number.trim(),
        Logo: logo.trim(),
        Description: description.trim(),
        Address: address,
      });

      onSuccessRegistered(newSeller);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit seller application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateDescription = async () => {
    if (!name.trim()) {
      setDescriptionError('Enter your business name first.');
      return;
    }

    setIsGeneratingDescription(true);
    setDescriptionError(null);
    try {
      const result = await api.generateAIDescription({ kind: 'shop', shopName: name.trim() });
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
        {/* Header */}
        <div className="px-6 py-4 border-b border-sky-100 dark:border-zinc-800/80 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-base">
                Apply for Merchant Partner
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Join the ShopNiro verified merchant network</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-2xl">
            💡 <strong>Approval Policy:</strong> Applications are registered with <strong>PENDING</strong> status until verified by Marketplace Governance.
          </div>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-2xl">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">Username *</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. apex_audio"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-2.5 pl-8 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <User className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-2.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">Business / Brand Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Apex Audio Labs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">Official Email *</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="contact@brand.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 pl-8 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-2.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">Account Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Set seller password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 pl-8 pr-9 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-2.5 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">Phone Number *</label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  placeholder="+880 1XXX-XXXXXX"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="w-full p-2.5 pl-8 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-2.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">Logo URL</label>
              <div className="relative">
                <input
                  type="url"
                  placeholder="https://..."
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  className="w-full p-2.5 pl-8 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                <Image className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-2.5 top-3" />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-1">
              <label className="block text-slate-700 dark:text-zinc-300 font-semibold">Brand Story &amp; Description</label>
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
              rows={2}
              placeholder="Tell buyers and admins about your brand and product quality..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDescriptionError(null);
              }}
              className="w-full p-2.5 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            {descriptionError && <p role="alert" className="mt-1 text-rose-600 dark:text-rose-300">{descriptionError}</p>}
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
            <h4 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-500" /> Business Headquarters Address
            </h4>
            <div className="mb-3">
              <label className="block text-slate-600 dark:text-zinc-400 mb-1">Location *</label>
              <AccountLocationPicker
                onAddressSelected={(selectedAddress) => {
                  setHasSelectedLocation(Boolean(selectedAddress));
                  setAddress((currentAddress) => selectedAddress
                    ? { ...currentAddress, ...selectedAddress }
                    : { ...currentAddress, Street: '', City: '', Postal_Code: '' });
                }}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 dark:text-zinc-400 mb-1">House / Suite / Building</label>
                <input
                  type="text"
                  placeholder="e.g. Suite 400"
                  value={address.House_Name}
                  onChange={(e) => setAddress({ ...address, House_Name: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-zinc-400 mb-1">Street Address *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 88 Innovation Way"
                  value={address.Street}
                  onChange={(e) => setAddress({ ...address, Street: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-zinc-400 mb-1">City *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Austin"
                  value={address.City}
                  onChange={(e) => setAddress({ ...address, City: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-zinc-400 mb-1">Postal Code</label>
                <input
                  type="text"
                  placeholder="e.g. 78701"
                  value={address.Postal_Code}
                  onChange={(e) => setAddress({ ...address, Postal_Code: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-[#181F2A] border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full shadow-lg shadow-emerald-500/30 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting Application...' : 'Submit Application'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
