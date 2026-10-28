import React from 'react';
import { Customer, Address } from '../../types';
import { User, Mail, Phone, MapPin, Save, CheckCircle2 } from 'lucide-react';
import { AccountLocationPicker } from '../AccountLocationPicker';
import { useLocale } from '../../lib/i18n';
import { api } from '../../lib/api';
import { downloadFile } from '../../lib/downloadFile';

interface CustomerProfileProps {
  currentCustomer: Customer;
  onUpdateCustomer: (updated: Customer) => void;
  onAccountDeleted: () => void;
}

export const CustomerProfile: React.FC<CustomerProfileProps> = ({ currentCustomer, onUpdateCustomer, onAccountDeleted }) => {
  const { t } = useLocale();
  const [name, setName] = React.useState(currentCustomer.Name);
  const [email, setEmail] = React.useState(currentCustomer.Email);
  const [number, setNumber] = React.useState(currentCustomer.Number);
  const [address, setAddress] = React.useState<Address>({
    Street: currentCustomer.Address?.Street || '',
    House_Name: currentCustomer.Address?.House_Name || '',
    City: currentCustomer.Address?.City || '',
    Postal_Code: currentCustomer.Address?.Postal_Code || '',
    Additional_Info: currentCustomer.Address?.Additional_Info || '',
    Latitude: currentCustomer.Address?.Latitude,
    Longitude: currentCustomer.Address?.Longitude,
  });

  const [savedSuccess, setSavedSuccess] = React.useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = React.useState(false);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [dataRightsMessage, setDataRightsMessage] = React.useState<string | null>(null);
  const [dataRightsError, setDataRightsError] = React.useState<string | null>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [confirmationEmail, setConfirmationEmail] = React.useState('');

  const handleExport = async () => {
    setDataRightsError(null);
    setDataRightsMessage(null);
    setIsExporting(true);
    try {
      const data = await api.exportCustomerData();
      await downloadFile(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
        'shopniro-data-export.json',
      );
      setDataRightsMessage(t('dataExportReady'));
    } catch (error) {
      setDataRightsError(error instanceof Error ? error.message : t('exportError'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setDataRightsError(null);
    setDataRightsMessage(null);
    if (confirmationEmail.trim().toLowerCase() !== currentCustomer.Email.trim().toLowerCase()) {
      setDataRightsError(t('confirmEmailForDeletion'));
      return;
    }
    setIsDeleting(true);
    try {
      await api.deleteCustomerAccount(confirmationEmail);
      setDataRightsMessage(t('accountDeleted'));
      onAccountDeleted();
    } catch (error) {
      setDataRightsError(error instanceof Error ? error.message : t('deleteError'));
    } finally {
      setIsDeleting(false);
    }
  };

  React.useEffect(() => {
    setName(currentCustomer.Name);
    setEmail(currentCustomer.Email);
    setNumber(currentCustomer.Number);
    setAddress({
      Street: currentCustomer.Address?.Street || '',
      House_Name: currentCustomer.Address?.House_Name || '',
      City: currentCustomer.Address?.City || '',
      Postal_Code: currentCustomer.Address?.Postal_Code || '',
      Additional_Info: currentCustomer.Address?.Additional_Info || '',
      Latitude: currentCustomer.Address?.Latitude,
      Longitude: currentCustomer.Address?.Longitude,
    });
    setIsResolvingLocation(false);
  }, [currentCustomer]);

  const updateLocationText = (field: 'Street' | 'City', value: string) => {
    setAddress((currentAddress) => ({
      ...currentAddress,
      [field]: value,
      Latitude: undefined,
      Longitude: undefined,
    }));
  };

  const hasMapLocation = typeof address.Latitude === 'number' && Number.isFinite(address.Latitude)
    && typeof address.Longitude === 'number' && Number.isFinite(address.Longitude);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isResolvingLocation) return;
    if (!hasMapLocation) {
      setProfileError(t('chooseShippingLocation'));
      return;
    }
    setProfileError(null);
    onUpdateCustomer({
      ...currentCustomer,
      Name: name,
      Email: email,
      Number: number,
      Address: address,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div className="bg-white dark:bg-[#12161D] p-6 rounded-3xl border border-brand-100 dark:border-surface-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-brand-600 text-white font-black text-lg flex items-center justify-center shadow-md shadow-brand-600/40">
            {currentCustomer.Name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-black text-surface-900 dark:text-white">{t('customerAccountAddress')}</h1>
            <p className="text-xs text-surface-500 dark:text-surface-400 font-mono">{t('identifier')}: {currentCustomer.Customer_ID}</p>
          </div>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-success-50 text-success-700 dark:bg-success-950/60 dark:text-success-300 rounded-3xl text-xs font-semibold flex items-center gap-2 border border-success-500/20 shadow-md">
          <CheckCircle2 className="w-5 h-5 text-success-500" />
          {t('profileSaved')}
        </div>
      )}

      {profileError && <p role="alert" className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-900 dark:bg-danger-950/40 dark:text-danger-300">{profileError}</p>}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#12161D] p-6 md:p-8 rounded-3xl border border-brand-100 dark:border-surface-800 shadow-xl space-y-6">
        {/* Personal Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-surface-900 dark:text-white flex items-center gap-2 border-b border-surface-100 dark:border-surface-800 pb-3">
            <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            {t('personalContact')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label htmlFor="customer-profile-name" className="block text-surface-600 dark:text-surface-400 mb-1 font-medium">{t('fullName')}</label>
              <div className="relative">
                <User className="w-4 h-4 text-surface-500 dark:text-surface-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  id="customer-profile-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="customer-profile-email" className="block text-surface-600 dark:text-surface-400 mb-1 font-medium">{t('emailAddress')}</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-surface-500 dark:text-surface-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  id="customer-profile-email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900 dark:text-white"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="customer-profile-phone" className="block text-surface-600 dark:text-surface-400 mb-1 font-medium">{t('phoneNumber')}</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-surface-500 dark:text-surface-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  id="customer-profile-phone"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="space-y-4 pt-4 border-t border-surface-100 dark:border-surface-800">
          <h3 className="text-sm font-bold text-surface-900 dark:text-white flex items-center gap-2 border-b border-surface-100 dark:border-surface-800 pb-3">
              <MapPin className="w-4 h-4 text-brand-600 dark:text-brand-400" />
              {t('defaultShipping')}
          </h3>

          <div id="customer-profile-location-picker" className="space-y-2">
            <AccountLocationPicker
              initialLocation={hasMapLocation ? { lat: address.Latitude!, lng: address.Longitude! } : null}
              onAddressSelected={(selectedAddress) => {
                if (!selectedAddress) {
                  setIsResolvingLocation(true);
                  return;
                }

                setIsResolvingLocation(false);
                setAddress((currentAddress) => ({
                  ...currentAddress,
                  Street: selectedAddress.Street || currentAddress.Street,
                  City: selectedAddress.City || currentAddress.City,
                  Postal_Code: selectedAddress.Postal_Code || currentAddress.Postal_Code,
                  Latitude: selectedAddress.Latitude,
                  Longitude: selectedAddress.Longitude,
                }));
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label htmlFor="customer-profile-house" className="block text-surface-600 dark:text-surface-400 mb-1 font-medium">{t('houseApartment')}</label>
              <input
                type="text"
                id="customer-profile-house"
                autoComplete="address-line2"
                required
                value={address.House_Name}
                onChange={(e) => setAddress({ ...address, House_Name: e.target.value })}
                className="w-full p-2.5 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="customer-profile-street" className="block text-surface-600 dark:text-surface-400 mb-1 font-medium">{t('streetName')}</label>
              <input
                type="text"
                id="customer-profile-street"
                autoComplete="street-address"
                required
                value={address.Street}
                onChange={(e) => updateLocationText('Street', e.target.value)}
                className="w-full p-2.5 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="customer-profile-city" className="block text-surface-600 dark:text-surface-400 mb-1 font-medium">{t('city')}</label>
              <input
                type="text"
                id="customer-profile-city"
                autoComplete="address-level2"
                required
                value={address.City}
                onChange={(e) => updateLocationText('City', e.target.value)}
                className="w-full p-2.5 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="customer-profile-postal" className="block text-surface-600 dark:text-surface-400 mb-1 font-medium">{t('postalCode')}</label>
              <input
                type="text"
                id="customer-profile-postal"
                autoComplete="postal-code"
                required
                value={address.Postal_Code}
                onChange={(e) => setAddress({ ...address, Postal_Code: e.target.value })}
                className="w-full p-2.5 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="customer-profile-notes" className="block text-surface-600 dark:text-surface-400 mb-1 font-medium">{t('deliveryNotes')}</label>
              <input
                type="text"
                id="customer-profile-notes"
                value={address.Additional_Info}
                onChange={(e) => setAddress({ ...address, Additional_Info: e.target.value })}
                className="w-full p-2.5 bg-surface-50 dark:bg-[#181F2A] border border-surface-200 dark:border-surface-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-surface-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isResolvingLocation}
            className="flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-full text-xs shadow-lg shadow-brand-600/30 transition-all cursor-pointer transform hover:-translate-y-0.5"
          >
            <Save className="w-4 h-4" />
            <span>{t('saveProfileAddress')}</span>
          </button>
        </div>
      </form>

      <section aria-labelledby="customer-data-rights-title" className="bg-white dark:bg-[#12161D] p-6 md:p-8 rounded-3xl border border-brand-100 dark:border-surface-800 shadow-xl space-y-5">
        <div>
          <h2 id="customer-data-rights-title" className="text-sm font-bold text-surface-900 dark:text-white">{t('dataAndAccount')}</h2>
          <p className="mt-2 text-xs leading-relaxed text-surface-600 dark:text-surface-400">
            {t('dataRightsDescription')}
          </p>
        </div>
        {dataRightsError && <p role="alert" className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-900 dark:bg-danger-950/40 dark:text-danger-300">{dataRightsError}</p>}
        {dataRightsMessage && <p role="status" className="rounded-xl border border-success-200 bg-success-50 p-3 text-sm text-success-700 dark:border-success-900 dark:bg-success-950/40 dark:text-success-300">{dataRightsMessage}</p>}
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={isExporting}
          className="min-h-11 rounded-full border border-brand-300 px-5 py-2 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-60 dark:border-brand-700 dark:text-brand-300 dark:hover:bg-brand-950/40"
        >
          {isExporting ? t('preparingExport') : t('downloadMyData')}
        </button>
        <form onSubmit={handleDeleteAccount} className="space-y-3 border-t border-surface-100 pt-4 dark:border-surface-800">
          <label htmlFor="delete-account-email" className="block text-xs font-semibold text-surface-700 dark:text-surface-300">
            {t('deleteAccountPrompt')} {currentCustomer.Email}
          </label>
          <input
            id="delete-account-email"
            type="email"
            autoComplete="email"
            required
            value={confirmationEmail}
            onChange={(event) => setConfirmationEmail(event.target.value)}
            className="w-full rounded-xl border border-surface-200 bg-surface-50 px-3 py-2.5 text-xs text-surface-900 focus:outline-none focus:ring-2 focus:ring-danger-500 dark:border-surface-700 dark:bg-[#181F2A] dark:text-white"
          />
          <button
            type="submit"
            disabled={isDeleting || isExporting}
            className="min-h-11 rounded-full bg-danger-700 px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-danger-600 disabled:opacity-60"
          >
            {isDeleting ? t('deletingAccount') : t('deleteMyAccount')}
          </button>
        </form>
      </section>
    </div>
  );
};
