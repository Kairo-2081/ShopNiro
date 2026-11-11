import React, { useState } from 'react';
import { Admin, Address } from '../../types';
import { AccountLocationPicker } from '../AccountLocationPicker';
import { X, ShieldPlus, Send, Eye, EyeOff, Lock, User, Mail, Phone, MapPin } from 'lucide-react';
import { useLocale } from '../../lib/i18n';

interface AdminSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterAdmin: (adminData: Partial<Admin> & { Username?: string }) => Promise<Admin>;
  onSuccessRegistered: (newAdmin: Admin) => void;
}

export const AdminSignupModal: React.FC<AdminSignupModalProps> = ({
  isOpen,
  onClose,
  onRegisterAdmin,
  onSuccessRegistered,
}) => {
  const { t } = useLocale();
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordState, setShowPasswordState] = useState(false);
  const [number, setNumber] = useState('');
  const [hasSelectedLocation, setHasSelectedLocation] = useState(false);
  const [address, setAddress] = useState<Address>({
    House_Name: '',
    Street: '',
    City: '',
    Postal_Code: '',
    Additional_Info: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please provide name, email, and set password.');
      return;
    }
    if (!number.trim() || !hasSelectedLocation || !address.Street.trim() || !address.City.trim()) {
      setError('Enter a phone number and use current location or select an office point on the map.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const finalUsername = (username.trim() || 'admin_' + (Date.now() % 1000)).toLowerCase();
      const newAdmin = await onRegisterAdmin({
        Username: finalUsername,
        Name: name.trim(),
        Email: email.trim(),
        Password: password.trim(),
        Number: number.trim(),
        Address: address,
      });

      setName('');
      setEmail('');
      setPassword('');
      setUsername('');
      setNumber('');
      setHasSelectedLocation(false);
      setAddress({ House_Name: '', Street: '', City: '', Postal_Code: '', Additional_Info: '' });

      onSuccessRegistered(newAdmin);
      onClose();
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(err.message || 'Failed to register admin account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#12161D] border border-brand-100 dark:border-brand-500/20 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-brand-100 dark:border-surface-800/80 flex items-center justify-between bg-brand-50/50 dark:bg-brand-950/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 text-white flex items-center justify-center shadow-lg shadow-brand-500/30">
              <ShieldPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-surface-900 dark:text-white">{t('adminOfficerRegistration')}</h3>
              <p className="text-xs text-surface-500 dark:text-surface-400">{t('registerGovernanceOfficer')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-danger-50 dark:bg-danger-950/40 border border-danger-200 dark:border-danger-900/60 text-danger-700 dark:text-danger-300 rounded-2xl">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-surface-700 dark:text-surface-300 font-semibold mb-1">Username *</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. elena_admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-2.5 pl-8 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <User className="w-3.5 h-3.5 text-surface-500 dark:text-surface-500 absolute left-2.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-surface-700 dark:text-surface-300 font-semibold mb-1">Full Legal Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Elena Rostova"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-surface-700 dark:text-surface-300 font-semibold mb-1">Official Email *</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="elena@marketplace.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 pl-8 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <Mail className="w-3.5 h-3.5 text-surface-500 dark:text-surface-500 absolute left-2.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-surface-700 dark:text-surface-300 font-semibold mb-1">Set Password *</label>
              <div className="relative">
                <input
                  type={showPasswordState ? 'text' : 'password'}
                  required
                  placeholder="Set admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 pl-8 pr-9 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <Lock className="w-3.5 h-3.5 text-surface-500 dark:text-surface-500 absolute left-2.5 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPasswordState(!showPasswordState)}
                  className="absolute right-2.5 top-3 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 cursor-pointer"
                >
                  {showPasswordState ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-surface-700 dark:text-surface-300 font-semibold mb-1">Phone Number *</label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  placeholder="+880 1XXX-XXXXXX"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="w-full p-2.5 pl-8 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white placeholder-surface-400 dark:placeholder-surface-500 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <Phone className="w-3.5 h-3.5 text-surface-500 dark:text-surface-500 absolute left-2.5 top-3" />
              </div>
            </div>

          </div>

          <div className="pt-2 border-t border-surface-100 dark:border-surface-800">
            <h4 className="font-semibold text-surface-900 dark:text-white mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-brand-500" /> {t('operationalOfficeAddress')}
            </h4>
            <div className="mb-3">
              <label className="block text-surface-600 dark:text-surface-400 mb-1">Location *</label>
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
                <label className="block text-surface-600 dark:text-surface-400 mb-1">{t('buildingFloor')}</label>
                <input
                  type="text"
                  placeholder="e.g. Floor 12"
                  value={address.House_Name}
                  onChange={(e) => setAddress({ ...address, House_Name: e.target.value })}
                  className="w-full p-2 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-surface-600 dark:text-surface-400 mb-1">Street Address *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1 Marketplace Plaza"
                  value={address.Street}
                  onChange={(e) => setAddress({ ...address, Street: e.target.value })}
                  className="w-full p-2 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-surface-600 dark:text-surface-400 mb-1">City *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. San Jose"
                  value={address.City}
                  onChange={(e) => setAddress({ ...address, City: e.target.value })}
                  className="w-full p-2 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-surface-600 dark:text-surface-400 mb-1">{t('postalCode')}</label>
                <input
                  type="text"
                  placeholder="e.g. 95113"
                  value={address.Postal_Code}
                  onChange={(e) => setAddress({ ...address, Postal_Code: e.target.value })}
                  className="w-full p-2 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800 rounded-full transition-colors cursor-pointer"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-full shadow-lg shadow-brand-500/30 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? t('registering') : t('registerOfficer')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
