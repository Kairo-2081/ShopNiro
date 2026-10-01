import React from 'react';
import { Address, Rider } from '../../types';
import { api } from '../../lib/api';
import { FileText, Lock, Save, X } from 'lucide-react';

interface RiderDetailsModalProps {
  isOpen: boolean;
  rider: Rider;
  onClose: () => void;
  onSaved: (rider: Rider) => void;
}

const emptyAddress = (): Address => ({
  House_Name: '',
  Street: '',
  City: '',
  Postal_Code: '',
  Additional_Info: '',
});

const toLines = (values: string[]) => values.join('\n');
const fromLines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean);
const addressKey = (address: Address) => JSON.stringify([
  address.House_Name || '', address.Street || '', address.City || '', address.Postal_Code || '',
  address.Additional_Info || '', address.Latitude ?? null, address.Longitude ?? null,
]);

export const RiderDetailsModal: React.FC<RiderDetailsModalProps> = ({ isOpen, rider, onClose, onSaved }) => {
  const [username, setUsername] = React.useState(rider.Username);
  const [name, setName] = React.useState(rider.Name);
  const [email, setEmail] = React.useState(rider.Email);
  const [phone, setPhone] = React.useState(rider.Number);
  const [password, setPassword] = React.useState('');
  const [presentAddress, setPresentAddress] = React.useState<Address>(rider.Present_Address || emptyAddress());
  const [permanentAddress, setPermanentAddress] = React.useState<Address>(rider.Permanent_Address || emptyAddress());
  const [experience, setExperience] = React.useState(toLines(rider.Experience || []));
  const [previousJobs, setPreviousJobs] = React.useState(toLines(rider.Previous_Jobs || []));
  const [education, setEducation] = React.useState(toLines(rider.Education || []));
  const [saving, setSaving] = React.useState(false);
  const [openingCv, setOpeningCv] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setUsername(rider.Username);
    setName(rider.Name);
    setEmail(rider.Email);
    setPhone(rider.Number);
    setPassword('');
    setPresentAddress(rider.Present_Address || emptyAddress());
    setPermanentAddress(rider.Permanent_Address || emptyAddress());
    setExperience(toLines(rider.Experience || []));
    setPreviousJobs(toLines(rider.Previous_Jobs || []));
    setEducation(toLines(rider.Education || []));
    setError(null);
    setNotice(null);
  }, [isOpen, rider]);

  if (!isOpen) return null;

  const profileChanged =
    username.trim().toLowerCase() !== rider.Username.trim().toLowerCase() ||
    name.trim() !== rider.Name.trim() ||
    email.trim().toLowerCase() !== rider.Email.trim().toLowerCase() ||
    phone.trim() !== rider.Number.trim() ||
    addressKey(presentAddress) !== addressKey(rider.Present_Address || emptyAddress()) ||
    addressKey(permanentAddress) !== addressKey(rider.Permanent_Address || emptyAddress()) ||
    JSON.stringify(fromLines(experience)) !== JSON.stringify(rider.Experience || []) ||
    JSON.stringify(fromLines(previousJobs)) !== JSON.stringify(rider.Previous_Jobs || []) ||
    JSON.stringify(fromLines(education)) !== JSON.stringify(rider.Education || []);
  const hasChanges = profileChanged || password.length > 0;

  const viewCv = async () => {
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      setError('Your browser blocked the CV preview. Allow pop-ups and try again.');
      return;
    }
    setOpeningCv(true);
    setError(null);
    try {
      const cv = await api.getMyRiderCv();
      const url = URL.createObjectURL(cv);
      previewWindow.location.replace(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      previewWindow.close();
      setError(err.message || 'Could not open your current CV.');
    } finally {
      setOpeningCv(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasChanges) {
      setError(null);
      setNotice('No changes detected. Your current approval remains unchanged.');
      return;
    }
    const hasCoordinates = (address: Address) =>
      Number.isFinite(address.Latitude) && Number.isFinite(address.Longitude);
    if (
      !presentAddress.Street || !presentAddress.City || !hasCoordinates(presentAddress) ||
      !permanentAddress.Street || !permanentAddress.City || !hasCoordinates(permanentAddress)
    ) {
      setError('Complete the street and city for both addresses. Their saved map locations will be retained.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateRiderProfile({
        Username: username,
        Name: name,
        Email: email,
        Number: phone,
        Password: password || undefined,
        Present_Address: presentAddress,
        Permanent_Address: permanentAddress,
        Experience: fromLines(experience),
        Previous_Jobs: fromLines(previousJobs),
        Education: fromLines(education),
      });
      onSaved(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Could not save your rider details.');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:border-zinc-700 dark:bg-[#181F2A] dark:text-white';
  const addressForms = [
    { title: 'Present address', value: presentAddress, set: setPresentAddress },
    { title: 'Permanent address', value: permanentAddress, set: setPermanentAddress },
  ];

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5">
      <section role="dialog" aria-modal="true" aria-labelledby="rider-details-title" className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-2xl dark:border-emerald-900 dark:bg-[#12161D]">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-emerald-50/70 px-5 py-4 dark:border-zinc-800 dark:bg-emerald-950/20 sm:px-7">
          <div>
            <h2 id="rider-details-title" className="font-bold text-slate-900 dark:text-white">My details</h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400">Profile changes refresh your CV and require approval. Password changes do not.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void viewCv()} disabled={openingCv} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"><FileText className="h-4 w-4" />{openingCv ? 'Opening...' : 'View my CV'}</button>
            <button type="button" onClick={onClose} aria-label="Close rider details" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
          </div>
        </header>

        <form onSubmit={save} className="space-y-6 overflow-y-auto p-5 sm:p-7">
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
          {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p>}

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Account and contact</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={fieldClass} required autoComplete="name" placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} />
              <input className={fieldClass} required autoComplete="username" placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} />
              <input className={fieldClass} required type="email" autoComplete="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} />
              <input className={fieldClass} required type="tel" autoComplete="tel" placeholder="Phone number" value={phone} onChange={(event) => setPhone(event.target.value)} />
              <div className="relative sm:col-span-2">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input className={`${fieldClass} pl-9`} type="password" minLength={8} autoComplete="new-password" placeholder="New password (leave blank to keep current)" value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
            </div>
          </section>

          {addressForms.map((addressForm) => (
            <section key={addressForm.title} className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{addressForm.title}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={fieldClass} required placeholder="House / building" value={addressForm.value.House_Name || ''} onChange={(event) => addressForm.set({ ...addressForm.value, House_Name: event.target.value })} />
                <input className={fieldClass} required placeholder="Street" value={addressForm.value.Street || ''} onChange={(event) => addressForm.set({ ...addressForm.value, Street: event.target.value })} />
                <input className={fieldClass} required placeholder="City" value={addressForm.value.City || ''} onChange={(event) => addressForm.set({ ...addressForm.value, City: event.target.value })} />
                <input className={fieldClass} placeholder="Postal code" value={addressForm.value.Postal_Code || ''} onChange={(event) => addressForm.set({ ...addressForm.value, Postal_Code: event.target.value })} />
              </div>
            </section>
          ))}

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Work and education history</h3>
            {[
              { label: 'Experience', value: experience, set: setExperience },
              { label: 'Previous jobs', value: previousJobs, set: setPreviousJobs },
              { label: 'Education and qualifications', value: education, set: setEducation },
            ].map((field) => (
              <label key={field.label} className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                {field.label}
                <textarea rows={3} value={field.value} onChange={(event) => field.set(event.target.value)} placeholder={`One item per line. Write “None” if not applicable.`} className={`${fieldClass} mt-1`} />
              </label>
            ))}
          </section>

          <footer className="flex flex-col-reverse justify-end gap-2 border-t border-slate-200 pt-4 dark:border-zinc-800 sm:flex-row">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-zinc-700 dark:text-zinc-200">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Saving details...' : 'Save details'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
};