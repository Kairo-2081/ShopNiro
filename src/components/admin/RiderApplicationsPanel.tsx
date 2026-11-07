import React from 'react';
import { Rider } from '../../types';
import { api } from '../../lib/api';
import { downloadFile } from '../../lib/downloadFile';
import { money } from '../../lib/format';
import { Check, Download, RefreshCw, X } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export const RiderApplicationsPanel: React.FC = () => {
  const [applications, setApplications] = React.useState<Rider[]>([]);
  const [withdrawals, setWithdrawals] = React.useState<any[]>([]);
  const [selected, setSelected] = React.useState<Rider | null>(null);
  useEscapeKey(() => setSelected(null), Boolean(selected));
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [busyWithdrawalId, setBusyWithdrawalId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const [nextApplications, nextWithdrawals] = await Promise.all([
        api.getRiderApplications(),
        api.getRiderWithdrawals(),
      ]);
      setApplications(nextApplications);
      setWithdrawals(nextWithdrawals);
    } catch (error: any) {
      setNotice(error.message || 'Could not load rider applications.');
    } finally {
      setLoading(false);
    }
  };

  const processWithdrawal = async (withdrawal: any, status: 'paid' | 'rejected') => {
    setBusyWithdrawalId(withdrawal.id);
    setNotice(null);
    try {
      await api.processRiderWithdrawal(withdrawal.id, status);
      setNotice(status === 'paid'
        ? `Withdrawal for ${withdrawal.rider_name} marked paid. Complete the payout using the listed account.`
        : `Withdrawal for ${withdrawal.rider_name} rejected and returned to the rider wallet.`);
      await loadApplications();
    } catch (error: any) {
      setNotice(error.message || 'Could not process this withdrawal.');
    } finally {
      setBusyWithdrawalId(null);
    }
  };

  React.useEffect(() => { void loadApplications(); }, []);

  const updateStatus = async (rider: Rider, status: 'approved' | 'rejected') => {
    setBusyId(rider.Rider_ID);
    setNotice(null);
    try {
      const reason = status === 'rejected'
        ? 'Application rejected after administrative review.'
        : 'Application approved after administrative review.';
      await api.setRiderApplicationStatus(rider.Rider_ID, status, reason);
      setNotice(`${rider.Name}'s application ${status}.`);
      setSelected(null);
      await loadApplications();
    } catch (error: any) {
      setNotice(error.message || 'Could not update this application.');
    } finally {
      setBusyId(null);
    }
  };

  const downloadCv = async (rider: Rider) => {
    try {
      const blob = await api.downloadRiderCv(rider.Rider_ID);
      const destination = await downloadFile(blob, rider.CV_File_Name || `${rider.Username}-cv.pdf`);
      setNotice(destination === 'saved' ? 'CV saved to Documents. Use the Android share sheet to open or send it.' : 'CV download started.');
    } catch (error: any) {
      setNotice(error.message || 'Could not download CV.');
    }
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-surface-900 dark:text-white">Rider applications</h2>
          <p className="text-xs text-surface-500 dark:text-surface-400">Review applicant details before enabling rider accounts.</p>
        </div>
        <button type="button" onClick={() => void loadApplications()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-surface-300 px-3 py-2 text-xs font-semibold text-surface-700 hover:bg-surface-50 disabled:opacity-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh
        </button>
      </header>
      {notice && <p role="status" className="rounded-lg border border-surface-200 bg-white p-3 text-sm text-surface-700 dark:border-surface-700 dark:bg-[#12161D] dark:text-surface-200">{notice}</p>}
      <div className="overflow-x-auto rounded-xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-[#12161D]">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-surface-50 text-xs text-surface-500 dark:bg-[#181F2A] dark:text-surface-400">
            <tr><th className="p-3">Applicant</th><th className="p-3">Contact</th><th className="p-3">CV</th><th className="p-3">Status</th><th className="p-3 text-right">Review</th></tr>
          </thead>
          <tbody className="divide-y divide-surface-200 dark:divide-surface-800">
            {applications.map((rider) => (
              <tr key={rider.Rider_ID}>
                <td className="p-3"><button type="button" onClick={() => setSelected(rider)} className="text-left font-semibold text-success-800 hover:underline dark:text-success-300">{rider.Name}<span className="mt-0.5 block font-mono text-micro font-normal text-surface-500">{rider.Username}</span></button></td>
                <td className="p-3 text-surface-700 dark:text-surface-300">{rider.Email}<span className="mt-0.5 block text-xs text-surface-500">{rider.Number}</span></td>
                <td className="p-3">{rider.Has_CV ? <button type="button" onClick={() => void downloadCv(rider)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"><Download className="h-3.5 w-3.5" />Download PDF</button> : <span className="text-xs text-surface-500">Manual profile</span>}</td>
                <td className="p-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-micro font-bold uppercase ${rider.Status === 'pending' ? 'bg-warning-100 text-warning-800 dark:bg-warning-950/40 dark:text-warning-300' : rider.Status === 'approved' ? 'bg-success-100 text-success-800 dark:bg-success-950/40 dark:text-success-300' : 'bg-danger-100 text-danger-800 dark:bg-danger-950/40 dark:text-danger-300'}`}>{rider.Status}</span></td>
                <td className="p-3 text-right">{rider.Status === 'pending' && <div className="inline-flex gap-2"><button type="button" disabled={busyId === rider.Rider_ID} onClick={() => void updateStatus(rider, 'approved')} className="inline-flex items-center gap-1 rounded-lg bg-success-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" />Approve</button><button type="button" disabled={busyId === rider.Rider_ID} onClick={() => void updateStatus(rider, 'rejected')} className="rounded-lg border border-surface-300 px-3 py-1.5 text-xs font-bold text-surface-700 disabled:opacity-50 dark:border-surface-700 dark:text-surface-200">Reject</button></div>}</td>
              </tr>
            ))}
            {!loading && applications.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-sm text-surface-500">No rider applications yet.</td></tr>}
            {loading && <tr><td colSpan={5} className="p-8 text-center text-sm text-surface-500">Loading applications...</td></tr>}
          </tbody>
        </table>
      </div>

      <section className="space-y-3 pt-4">
        <div><h3 className="text-base font-bold text-surface-900 dark:text-white">Salary withdrawal requests</h3><p className="text-xs text-surface-500 dark:text-surface-400">Complete the external payout before marking it paid.</p></div>
        <div className="overflow-x-auto rounded-xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-[#12161D]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface-50 text-xs text-surface-500 dark:bg-[#181F2A] dark:text-surface-400"><tr><th className="p-3">Rider</th><th className="p-3">Amount</th><th className="p-3">Method / Account</th><th className="p-3">Requested</th><th className="p-3 text-right">Payout</th></tr></thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-800">
              {withdrawals.map((withdrawal) => <tr key={withdrawal.id}><td className="p-3 font-semibold text-surface-900 dark:text-white">{withdrawal.rider_name}</td><td className="p-3 text-right font-bold tabular-nums text-surface-900 dark:text-white">{money(Number(withdrawal.amount))}</td><td className="p-3 text-surface-700 dark:text-surface-300">{withdrawal.payout_method}<span className="mt-0.5 block break-all text-xs text-surface-700 dark:text-surface-300">{withdrawal.payout_account}</span></td><td className="p-3 text-xs text-surface-700 dark:text-surface-300">{new Date(withdrawal.requested_at).toLocaleString()}</td><td className="p-3 text-right"><div className="inline-flex gap-2"><button type="button" disabled={busyWithdrawalId === withdrawal.id} onClick={() => void processWithdrawal(withdrawal, 'rejected')} className="min-h-10 rounded-lg border border-surface-300 px-3 py-1.5 text-xs font-bold text-surface-700 disabled:opacity-50 dark:border-surface-700 dark:text-surface-200">Reject</button><button type="button" disabled={busyWithdrawalId === withdrawal.id} onClick={() => void processWithdrawal(withdrawal, 'paid')} className="min-h-10 rounded-lg bg-success-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{busyWithdrawalId === withdrawal.id ? 'Saving...' : 'Mark paid'}</button></div></td></tr>)}
              {!withdrawals.length && <tr><td colSpan={5} className="p-6 text-center text-sm text-surface-500">No pending withdrawals.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150" onClick={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="rider-review-title" className="w-full max-w-xl space-y-5 rounded-2xl border border-brand-100 bg-white p-5 shadow-2xl ring-1 ring-white/10 animate-in fade-in slide-in-from-bottom-2 duration-200 dark:border-brand-500/20 dark:bg-[#12161D]">
            <header className="flex items-start justify-between gap-4"><div><h3 id="rider-review-title" className="text-lg font-bold text-surface-900 dark:text-white">{selected.Name}</h3><p className="text-xs text-surface-500">{selected.Email} · {selected.Number}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Close details" className="rounded-full p-2 hover:bg-surface-100 dark:hover:bg-surface-800"><X className="h-4 w-4" /></button></header>
            <div className="max-h-[55vh] space-y-4 overflow-y-auto text-sm">
              <div><h4 className="mb-1 text-xs font-bold uppercase text-surface-500">Present address</h4><p className="text-surface-800 dark:text-surface-200">{Object.values(selected.Present_Address || {}).filter(Boolean).join(', ') || 'Not supplied'}</p></div>
              <div><h4 className="mb-1 text-xs font-bold uppercase text-surface-500">Permanent address</h4><p className="text-surface-800 dark:text-surface-200">{Object.values(selected.Permanent_Address || {}).filter(Boolean).join(', ') || 'Not supplied'}</p></div>
              {[['Experience', selected.Experience], ['Previous jobs', selected.Previous_Jobs], ['Education', selected.Education]].map(([title, lines]) => <div key={title as string}><h4 className="mb-1 text-xs font-bold uppercase text-surface-500">{title as string}</h4><ul className="list-inside list-disc space-y-1 text-surface-800 dark:text-surface-200">{(lines as string[]).length ? (lines as string[]).map((line) => <li key={line}>{line}</li>) : <li className="list-none text-surface-500">Not supplied</li>}</ul></div>)}
            </div>
            <footer className="flex justify-end gap-2 border-t border-surface-200 pt-4 dark:border-surface-800">
              {selected.Has_CV && <button type="button" onClick={() => void downloadCv(selected)} className="mr-auto inline-flex items-center gap-2 rounded-lg border border-surface-300 px-3 py-2 text-xs font-semibold dark:border-surface-700"><Download className="h-4 w-4" />Download CV</button>}
              {selected.Status === 'pending' && <><button type="button" onClick={() => void updateStatus(selected, 'rejected')} disabled={busyId === selected.Rider_ID} className="rounded-lg border border-surface-300 px-4 py-2 text-xs font-bold dark:border-surface-700">Reject</button><button type="button" onClick={() => void updateStatus(selected, 'approved')} disabled={busyId === selected.Rider_ID} className="rounded-lg bg-success-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busyId === selected.Rider_ID ? 'Updating...' : 'Approve rider'}</button></>}
            </footer>
          </section>
        </div>
      )}
    </section>
  );
};