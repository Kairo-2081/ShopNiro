import React from 'react';
import { Address, Rider } from '../../types';
import { api } from '../../lib/api';
import { getProfileCompletion } from '../../lib/profileCompletion';
import { prepareProfileImage } from '../../lib/profileImage';
import { AccountLocationPicker } from '../AccountLocationPicker';
import { ChevronLeft, ChevronRight, FileText, Image as ImageIcon, Lock, Save, X } from 'lucide-react';
import type * as PdfJs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { useEscapeKey } from '../../hooks/useEscapeKey';


// pdf.js is large, so it is loaded the first time a CV is previewed, not with the rider dashboard.
async function loadPdfJs(): Promise<typeof PdfJs> {
  const [pdfjsLib, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjsLib;
}

type RiderCvDocument = Awaited<ReturnType<typeof PdfJs.getDocument>['promise']>;

const RiderCvPreview: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => {
  useEscapeKey(onClose);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [pdfDocument, setPdfDocument] = React.useState<RiderCvDocument | null>(null);
  const [pageNumber, setPageNumber] = React.useState(1);
  const [containerWidth, setContainerWidth] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let isActive = true;
    let destroy: (() => Promise<void>) | undefined;
    setPdfDocument(null);
    setPageNumber(1);
    setError(null);
    loadPdfJs().then((pdfjsLib) => {
      if (!isActive) return undefined;
      const loadingTask = pdfjsLib.getDocument(url);
      destroy = () => loadingTask.destroy();
      return loadingTask.promise;
    }).then((document) => {
      if (isActive && document) setPdfDocument(document);
    }).catch(() => {
      if (isActive) setError('Could not render this CV.');
    });
    return () => {
      isActive = false;
      void destroy?.().catch(() => undefined);
    };
  }, [url]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => setContainerWidth(container.clientWidth));
    observer.observe(container);
    setContainerWidth(container.clientWidth);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!pdfDocument || !canvasRef.current || !containerWidth) return;
    let isActive = true;
    let renderTask: { cancel: () => void } | null = null;
    const renderPage = async () => {
      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (!isActive || !canvasRef.current) return;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(1.5, Math.max(0.1, (containerWidth - 32) / baseViewport.width));
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is unavailable.');
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        renderTask = page.render({ canvasContext: context, viewport });
        await (renderTask as ReturnType<typeof page.render>).promise;
      } catch {
        if (isActive) setError('Could not render this CV page.');
      }
    };
    void renderPage();
    return () => {
      isActive = false;
      renderTask?.cancel();
    };
  }, [containerWidth, pageNumber, pdfDocument]);

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 p-2 sm:p-5">
      <section role="dialog" aria-modal="true" aria-labelledby="rider-cv-title" className="flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-surface-300 bg-white shadow-2xl dark:border-surface-700 dark:bg-[#12161D]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <h2 id="rider-cv-title" className="font-bold text-surface-900 dark:text-white">My CV</h2>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Previous CV page" disabled={!pdfDocument || pageNumber <= 1} onClick={() => setPageNumber((page) => Math.max(1, page - 1))} className="rounded-md p-2 text-surface-700 hover:bg-surface-100 disabled:opacity-40 dark:text-surface-200 dark:hover:bg-surface-800"><ChevronLeft className="h-5 w-5" /></button>
            <span className="min-w-16 text-center text-xs text-surface-600 dark:text-surface-300">{pdfDocument ? `${pageNumber} / ${pdfDocument.numPages}` : 'Loading'}</span>
            <button type="button" aria-label="Next CV page" disabled={!pdfDocument || pageNumber >= pdfDocument.numPages} onClick={() => setPageNumber((page) => Math.min(pdfDocument?.numPages || page, page + 1))} className="rounded-md p-2 text-surface-700 hover:bg-surface-100 disabled:opacity-40 dark:text-surface-200 dark:hover:bg-surface-800"><ChevronRight className="h-5 w-5" /></button>
            <button type="button" onClick={onClose} aria-label="Close CV preview" className="rounded-md p-2 text-surface-500 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800"><X className="h-5 w-5" /></button>
          </div>
        </header>
        <div ref={containerRef} className="min-h-0 flex-1 overflow-auto bg-surface-200 p-4 dark:bg-[#080a0c]">
          {error ? <p role="alert" className="p-6 text-center text-sm text-danger-700 dark:text-danger-300">{error}</p> : !pdfDocument ? <p role="status" className="p-6 text-center text-sm text-surface-600 dark:text-surface-300">Preparing CV preview...</p> : <canvas ref={canvasRef} aria-label={`CV page ${pageNumber}`} className="mx-auto block max-w-full shadow-lg" />}
        </div>
      </section>
    </div>
  );
};

interface RiderDetailsModalProps {
  isOpen: boolean;
  rider: Rider;
  onClose: () => void;
  onSaved: (rider: Rider) => void;
  required?: boolean;
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

export const RiderDetailsModal: React.FC<RiderDetailsModalProps> = ({ isOpen, rider, onClose, onSaved, required = false }) => {
  useEscapeKey(onClose, isOpen);
  const [username, setUsername] = React.useState(rider.Username);
  const [name, setName] = React.useState(rider.Name);
  const [email, setEmail] = React.useState(rider.Email);
  const [phone, setPhone] = React.useState(rider.Number);
  const [password, setPassword] = React.useState('');
  const [profileImage, setProfileImage] = React.useState(rider.Profile_Image || '');
  const [profileImageFile, setProfileImageFile] = React.useState<File | null>(null);
  const [preparingProfileImage, setPreparingProfileImage] = React.useState(false);
  const [presentAddress, setPresentAddress] = React.useState<Address>(rider.Present_Address || emptyAddress());
  const [permanentAddress, setPermanentAddress] = React.useState<Address>(rider.Permanent_Address || emptyAddress());
  const [experience, setExperience] = React.useState(toLines(rider.Experience || []));
  const [previousJobs, setPreviousJobs] = React.useState(toLines(rider.Previous_Jobs || []));
  const [education, setEducation] = React.useState(toLines(rider.Education || []));
  const [saving, setSaving] = React.useState(false);
  const [openingCv, setOpeningCv] = React.useState(false);
  const [cvUrl, setCvUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => () => {
    if (cvUrl) URL.revokeObjectURL(cvUrl);
  }, [cvUrl]);

  React.useEffect(() => {
    if (!isOpen) return;
    setUsername(rider.Username);
    setName(rider.Name);
    setEmail(rider.Email);
    setPhone(rider.Number);
    setPassword('');
    setProfileImage(rider.Profile_Image || '');
    setProfileImageFile(null);
    setPreparingProfileImage(false);
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
    profileImage !== (rider.Profile_Image || '') ||
    addressKey(presentAddress) !== addressKey(rider.Present_Address || emptyAddress()) ||
    addressKey(permanentAddress) !== addressKey(rider.Permanent_Address || emptyAddress()) ||
    JSON.stringify(fromLines(experience)) !== JSON.stringify(rider.Experience || []) ||
    JSON.stringify(fromLines(previousJobs)) !== JSON.stringify(rider.Previous_Jobs || []) ||
    JSON.stringify(fromLines(education)) !== JSON.stringify(rider.Education || []);
  const profileImageChanged = profileImage !== (rider.Profile_Image || '');
  const hasProfileChanges = profileChanged || profileImageChanged;
  const hasChanges = hasProfileChanges || password.length > 0;

  const viewCv = async () => {
    setOpeningCv(true);
    setError(null);
    try {
      const cv = await api.getMyRiderCv();
      setCvUrl(URL.createObjectURL(cv));
    } catch (err: any) {
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
    const completion = getProfileCompletion('rider', {
      Username: username,
      Name: name,
      Email: email,
      Number: phone,
      Present_Address: presentAddress,
      Permanent_Address: permanentAddress,
      Experience: fromLines(experience),
      Previous_Jobs: fromLines(previousJobs),
      Education: fromLines(education),
    });
    if (!completion.complete) {
      setError(`Complete your profile first: ${completion.missingFields.join(', ')}.`);
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
        Profile_Image: profileImageChanged ? profileImage : undefined,
        Profile_Image_File_Name: profileImageChanged ? profileImageFile?.name : undefined,
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

  const fieldClass = 'w-full rounded-lg border border-surface-300 bg-white px-3 py-2.5 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-success-600 dark:border-surface-700 dark:bg-[#181F2A] dark:text-white';
  const handleProfileImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setProfileImageFile(file);
    setError(null);
    if (!file) return;

    setPreparingProfileImage(true);
    void prepareProfileImage(file).then((dataUrl) => {
      setProfileImage(dataUrl);
    }).catch((err: Error) => {
      setError(err.message || 'Could not read this profile image.');
      setProfileImageFile(null);
      event.target.value = '';
    }).finally(() => {
      setPreparingProfileImage(false);
    });
  };
  const addressForms = [
    { title: 'Present address', value: presentAddress, set: setPresentAddress },
    { title: 'Permanent address', value: permanentAddress, set: setPermanentAddress },
  ];

  return (
    <>
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5">
      <section role="dialog" aria-modal="true" aria-labelledby="rider-details-title" className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-success-200 bg-white shadow-2xl dark:border-success-900 dark:bg-[#12161D]">
        <header className="flex items-center justify-between gap-4 border-b border-surface-200 bg-success-50/70 px-5 py-4 dark:border-surface-800 dark:bg-success-950/20 sm:px-7">
          <div>
            <h2 id="rider-details-title" className="font-bold text-surface-900 dark:text-white">My details</h2>
            <p className="mt-1 text-xs text-surface-600 dark:text-surface-400">Profile changes refresh your CV and require approval. Password changes do not.</p>
            {required && <p role="status" className="mt-2 text-xs font-semibold text-warning-800 dark:text-warning-200">Complete and save your profile before making other changes.</p>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void viewCv()} disabled={openingCv} className="inline-flex items-center gap-2 rounded-lg border border-surface-300 px-3 py-2 text-xs font-semibold text-surface-700 disabled:opacity-50 dark:border-surface-700 dark:text-surface-200"><FileText className="h-4 w-4" />{openingCv ? 'Opening...' : 'View my CV'}</button>
            <button type="button" onClick={onClose} aria-label="Close rider details" className="rounded-md p-2 text-surface-500 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800"><X className="h-5 w-5" /></button>
          </div>
        </header>

        <form onSubmit={save} className="space-y-6 overflow-y-auto p-5 sm:p-7">
          {error && <p role="alert" className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-900 dark:bg-danger-950/40 dark:text-danger-300">{error}</p>}
          {notice && <p role="status" className="rounded-lg border border-success-200 bg-success-50 p-3 text-sm text-success-800 dark:border-success-900 dark:bg-success-950/30 dark:text-success-200">{notice}</p>}

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-surface-900 dark:text-white">Account and contact</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={fieldClass} required autoComplete="name" placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} />
              <input className={fieldClass} required autoComplete="username" placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} />
              <input className={fieldClass} required type="email" autoComplete="email" placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} />
              <input className={fieldClass} required type="tel" autoComplete="tel" placeholder="Phone number" value={phone} onChange={(event) => setPhone(event.target.value)} />
              <div className="relative sm:col-span-2">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-surface-400" />
                <input className={`${fieldClass} pl-9`} type="password" minLength={8} autoComplete="new-password" placeholder="New password (leave blank to keep current)" value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-surface-900 dark:text-white">Profile photo</h3>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-success-400 bg-success-50/60 p-4 text-sm text-surface-700 dark:border-success-800 dark:bg-success-950/20 dark:text-surface-200">
              {profileImage ? <img src={profileImage} alt="Rider profile preview" className="h-14 w-14 rounded-xl border border-success-200 object-cover dark:border-success-800" /> : <ImageIcon className="h-5 w-5 shrink-0 text-success-700 dark:text-success-400" />}
              <span className="min-w-0 flex-1">{profileImageFile ? `${profileImageFile.name} · Ready` : 'Upload / change profile image (JPG or PNG, max 2 MB)'}</span>
              <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={handleProfileImageChange} />
            </label>
            <p className="text-xs text-surface-500 dark:text-surface-400">Saving a new photo automatically updates the image in your generated CV.</p>
          </section>

          {addressForms.map((addressForm) => (
            <section key={addressForm.title} className="space-y-3">
              <h3 className="text-sm font-bold text-surface-900 dark:text-white">{addressForm.title}</h3>
              <AccountLocationPicker
                initialLocation={Number.isFinite(addressForm.value.Latitude) && Number.isFinite(addressForm.value.Longitude)
                  ? { lat: addressForm.value.Latitude!, lng: addressForm.value.Longitude! }
                  : null}
                onAddressSelected={(selected) => addressForm.set(selected
                  ? { ...addressForm.value, ...selected }
                  : { ...addressForm.value, Latitude: undefined, Longitude: undefined })}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={fieldClass} required placeholder="House / building" value={addressForm.value.House_Name || ''} onChange={(event) => addressForm.set({ ...addressForm.value, House_Name: event.target.value })} />
                <input className={fieldClass} required placeholder="Street" value={addressForm.value.Street || ''} onChange={(event) => addressForm.set({ ...addressForm.value, Street: event.target.value })} />
                <input className={fieldClass} required placeholder="City" value={addressForm.value.City || ''} onChange={(event) => addressForm.set({ ...addressForm.value, City: event.target.value })} />
                <input className={fieldClass} placeholder="Postal code" value={addressForm.value.Postal_Code || ''} onChange={(event) => addressForm.set({ ...addressForm.value, Postal_Code: event.target.value })} />
              </div>
            </section>
          ))}

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-surface-900 dark:text-white">Work and education history</h3>
            {[
              { label: 'Experience', value: experience, set: setExperience },
              { label: 'Previous jobs', value: previousJobs, set: setPreviousJobs },
              { label: 'Education and qualifications', value: education, set: setEducation },
            ].map((field) => (
              <label key={field.label} className="block text-xs font-semibold text-surface-700 dark:text-surface-300">
                {field.label}
                <textarea rows={3} value={field.value} onChange={(event) => field.set(event.target.value)} placeholder={`One item per line. Write “None” if not applicable.`} className={`${fieldClass} mt-1`} />
              </label>
            ))}
          </section>

          <footer className="flex flex-col-reverse justify-end gap-2 border-t border-surface-200 pt-4 dark:border-surface-800 sm:flex-row">
            <button type="button" onClick={onClose} className="rounded-lg border border-surface-300 px-4 py-2.5 text-sm font-semibold text-surface-700 dark:border-surface-700 dark:text-surface-200">Cancel</button>
            <button type="submit" disabled={saving || preparingProfileImage} className="inline-flex items-center justify-center gap-2 rounded-lg bg-success-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{preparingProfileImage ? 'Preparing photo...' : saving ? 'Saving details...' : 'Save details'}</button>
          </footer>
        </form>
      </section>
    </div>
    {cvUrl && <RiderCvPreview url={cvUrl} onClose={() => setCvUrl(null)} />}
    </>
  );
};