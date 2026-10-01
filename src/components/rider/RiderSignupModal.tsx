import React from 'react';
import { Address } from '../../types';
import { api } from '../../lib/api';
import { AccountLocationPicker } from '../AccountLocationPicker';
import { Lock, MapPin, ShieldCheck, Sparkles, Truck, UploadCloud, X } from 'lucide-react';

interface RiderSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogin: () => void;
  onSubmitted: (message: string) => void;
}

const emptyAddress = (): Address => ({
  House_Name: '',
  Street: '',
  City: '',
  Postal_Code: '',
  Additional_Info: '',
});

const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read this PDF.'));
  reader.onerror = () => reject(new Error('Could not read this PDF.'));
  reader.readAsDataURL(file);
});

const toLines = (values: string[]) => values.join('\n');
const fromLines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean);

export const RiderSignupModal: React.FC<RiderSignupModalProps> = ({ isOpen, onClose, onOpenLogin, onSubmitted }) => {
  const [username, setUsername] = React.useState('');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [presentAddress, setPresentAddress] = React.useState<Address>(emptyAddress);
  const [permanentAddress, setPermanentAddress] = React.useState<Address>(emptyAddress);
  const [hasCv, setHasCv] = React.useState<boolean | null>(null);
  const [cvFile, setCvFile] = React.useState<File | null>(null);
  const [cvBase64, setCvBase64] = React.useState('');
  const [experience, setExperience] = React.useState('');
  const [previousJobs, setPreviousJobs] = React.useState('');
  const [education, setEducation] = React.useState('');
  const [missingFields, setMissingFields] = React.useState<string[]>([]);
  const [isParsing, setIsParsing] = React.useState(false);
  const [isFormatting, setIsFormatting] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCvChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setCvFile(file);
    setCvBase64('');
    setMissingFields([]);
    if (!file) return;
    if (file.type !== 'application/pdf' || file.size > 3 * 1024 * 1024) {
      setError('Choose a PDF CV no larger than 3 MB.');
      setCvFile(null);
      return;
    }

    setIsParsing(true);
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setCvBase64(dataUrl);
      const result = await api.parseRiderCv(dataUrl);
      setExperience(toLines(result.extracted.experience));
      setPreviousJobs(toLines(result.extracted.previousJobs));
      setEducation(toLines(result.extracted.education));
      setMissingFields(result.missingFields);
    } catch (err: any) {
      setError(`${err.message || 'Could not extract the CV.'} You can enter all details manually.`);
      setMissingFields(['experience', 'previousJobs', 'education']);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFormat = async () => {
    setIsFormatting(true);
    setError(null);
    try {
      const formatted = await api.formatRiderCv({
        experience: fromLines(experience),
        previousJobs: fromLines(previousJobs),
        education: fromLines(education),
      });
      setExperience(toLines(formatted.experience));
      setPreviousJobs(toLines(formatted.previousJobs));
      setEducation(toLines(formatted.education));
    } catch (err: any) {
      setError(err.message || 'Could not format these details. You can still submit them as entered.');
    } finally {
      setIsFormatting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (hasCv === null) {
      setError('Choose whether you have a CV.');
      return;
    }
    if (hasCv && !cvBase64) {
      setError('Upload your PDF CV before continuing.');
      return;
    }
    if (![experience, previousJobs, education].every((value) => value.trim())) {
      setError('Complete each work and education field. Write “None” where it does not apply.');
      return;
    }
    if (
      !presentAddress.Street || !presentAddress.City || !permanentAddress.Street || !permanentAddress.City ||
      !Number.isFinite(presentAddress.Latitude) || !Number.isFinite(presentAddress.Longitude) ||
      !Number.isFinite(permanentAddress.Latitude) || !Number.isFinite(permanentAddress.Longitude)
    ) {
      setError('Choose both address locations on their maps and confirm the streets and cities.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await api.applyRider({
        Username: username,
        Name: name,
        Email: email,
        Password: password,
        Number: phone,
        Present_Address: presentAddress,
        Permanent_Address: permanentAddress,
        Has_CV: hasCv,
        CV_Base64: hasCv ? cvBase64 : undefined,
        CV_File_Name: hasCv ? cvFile?.name : undefined,
        Experience: fromLines(experience),
        Previous_Jobs: fromLines(previousJobs),
        Education: fromLines(education),
      });
      onSubmitted(result.message);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Could not submit the rider application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:border-zinc-700 dark:bg-[#181F2A] dark:text-white';
  const resumeFields = [
    { key: 'experience', title: 'Experience', value: experience, set: setExperience, placeholder: 'Describe relevant experience, one item per line.' },
    { key: 'previousJobs', title: 'Previous jobs', value: previousJobs, set: setPreviousJobs, placeholder: 'List previous roles and employers, one per line.' },
    { key: 'education', title: 'Education and qualifications', value: education, set: setEducation, placeholder: 'List schools, qualifications, or training, one per line.' },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5">
      <section role="dialog" aria-modal="true" aria-labelledby="rider-application-title" className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xl dark:border-emerald-900 dark:bg-[#12161D]">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-emerald-50/70 px-5 py-4 dark:border-zinc-800 dark:bg-emerald-950/20 sm:px-7">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white"><Truck className="h-5 w-5" /></span>
            <div>
              <h2 id="rider-application-title" className="font-bold text-slate-900 dark:text-white">Delivery rider portal</h2>
              <p className="text-xs text-slate-600 dark:text-zinc-400">Apply to join ShopNiro delivery operations</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close rider application" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"><X className="h-5 w-5" /></button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto p-5 sm:p-7">
          <button
            type="button"
            onClick={() => { onClose(); onOpenLogin(); }}
            className="text-sm font-semibold text-emerald-800 underline decoration-emerald-400 underline-offset-4 dark:text-emerald-300"
          >
            Already applied? Sign in to the rider portal
          </button>

          {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Account and contact</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={fieldClass} required autoComplete="name" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className={fieldClass} required autoComplete="username" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
              <input className={fieldClass} required type="email" autoComplete="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input className={fieldClass} required type="tel" autoComplete="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <div className="relative sm:col-span-2">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input className={`${fieldClass} pl-9`} required minLength={8} type="password" autoComplete="new-password" placeholder="Password (at least 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
          </section>

          {[{ title: 'Present address', value: presentAddress, set: setPresentAddress }, { title: 'Permanent address', value: permanentAddress, set: setPermanentAddress }].map((addressForm) => (
            <section key={addressForm.title} className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white"><MapPin className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />{addressForm.title}</h3>
              <AccountLocationPicker onAddressSelected={(selected) => addressForm.set(selected ? { ...addressForm.value, ...selected } : { ...addressForm.value, Street: '', City: '' })} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={fieldClass} required placeholder="House / building" value={addressForm.value.House_Name} onChange={(e) => addressForm.set({ ...addressForm.value, House_Name: e.target.value })} />
                <input className={fieldClass} required placeholder="Street" value={addressForm.value.Street} onChange={(e) => addressForm.set({ ...addressForm.value, Street: e.target.value })} />
                <input className={fieldClass} required placeholder="City" value={addressForm.value.City} onChange={(e) => addressForm.set({ ...addressForm.value, City: e.target.value })} />
                <input className={fieldClass} placeholder="Postal code" value={addressForm.value.Postal_Code} onChange={(e) => addressForm.set({ ...addressForm.value, Postal_Code: e.target.value })} />
              </div>
            </section>
          ))}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Work and education history</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">Your details are used for this application only.</p>
              </div>
              {hasCv === false && (
                <button type="button" onClick={handleFormat} disabled={isFormatting} className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30">
                  <Sparkles className="h-4 w-4" />{isFormatting ? 'Formatting...' : 'Format details with AI'}
                </button>
              )}
            </div>
            <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Do you have an existing CV to import?</legend>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-zinc-700 dark:bg-zinc-900">
                {[true, false].map((choice) => (
                  <button key={String(choice)} type="button" aria-pressed={hasCv === choice} onClick={() => { setHasCv(choice); if (!choice) { setCvFile(null); setCvBase64(''); } setError(null); }} className={`rounded-md px-5 py-2 text-sm font-semibold ${hasCv === choice ? 'bg-emerald-700 text-white' : 'text-slate-700 dark:text-zinc-300'}`}>
                    {choice ? 'Yes, import a CV' : 'No, enter details'}
                  </button>
                ))}
              </div>
            </fieldset>

            {hasCv === true && (
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/60 p-4 text-sm text-slate-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-zinc-200">
                <UploadCloud className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                <span className="min-w-0 flex-1">{cvFile ? `${cvFile.name} · ${isParsing ? 'Reading CV...' : 'Ready'}` : 'Upload a PDF CV (required, maximum 3 MB)'}</span>
                <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={handleCvChange} />
              </label>
            )}

            {hasCv !== null && resumeFields.map((field) => (
              <div key={field.key} className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">{field.title}</label>
                {missingFields.includes(field.key) && <p className="text-xs text-amber-700 dark:text-amber-300">This information was not found in the CV. Please add it manually.</p>}
                <textarea rows={2} value={field.value} onChange={(e) => field.set(e.target.value)} placeholder={field.placeholder} className={fieldClass} />
              </div>
            ))}
          </section>

          <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-200 pt-5 dark:border-zinc-800 sm:flex-row sm:items-center">
            <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400"><ShieldCheck className="h-4 w-4 shrink-0" />ShopNiro generates and saves a formatted CV PDF from your application details.</p>
            <button type="submit" disabled={isSubmitting || isParsing} className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
              {isSubmitting ? 'Submitting application...' : 'Submit rider application'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};