import React from 'react';
import { Rider } from '../../types';
import { api } from '../../lib/api';
import { Check, Download, RefreshCw, X } from 'lucide-react';

export const RiderApplicationsPanel: React.FC = () => {
  const [applications, setApplications] = React.useState<Rider[]>([]);
  const [withdrawals, setWithdrawals] = React.useState<any[]>([]);
  const [selected, setSelected] = React.useState<Rider | null>(null);
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
      await api.setRiderApplicationStatus(rider.Rider_ID, status);
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
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = rider.CV_File_Name || `${rider.Username}-cv.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      setNotice(error.message || 'Could not download CV.');
    }
  };

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Rider applications</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Review applicant details before enabling rider accounts.</p>
        </div>
        <button type="button" onClick={() => void loadApplications()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh
        </button>
      </header>
      {notice && <p role="status" className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-zinc-700 dark:bg-[#12161D] dark:text-zinc-200">{notice}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-[#12161D]">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-[#181F2A] dark:text-zinc-400">
            <tr><th className="p-3">Applicant</th><th className="p-3">Contact</th><th className="p-3">CV</th><th className="p-3">Status</th><th className="p-3 text-right">Review</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
            {applications.map((rider) => (
              <tr key={rider.Rider_ID}>
                <td className="p-3"><button type="button" onClick={() => setSelected(rider)} className="text-left font-semibold text-emerald-800 hover:underline dark:text-emerald-300">{rider.Name}<span className="mt-0.5 block font-mono text-[10px] font-normal text-slate-500">{rider.Username}</span></button></td>
                <td className="p-3 text-slate-700 dark:text-zinc-300">{rider.Email}<span className="mt-0.5 block text-xs text-slate-500">{rider.Number}</span></td>
                <td className="p-3">{rider.Has_CV ? <button type="button" onClick={() => void downloadCv(rider)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline dark:text-sky-300"><Download className="h-3.5 w-3.5" />Download PDF</button> : <span className="text-xs text-slate-500">Manual profile</span>}</td>
                <td className="p-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${rider.Status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : rider.Status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'}`}>{rider.Status}</span></td>
                <td className="p-3 text-right">{rider.Status === 'pending' && <div className="inline-flex gap-2"><button type="button" disabled={busyId === rider.Rider_ID} onClick={() => void updateStatus(rider, 'approved')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" />Approve</button><button type="button" disabled={busyId === rider.Rider_ID} onClick={() => void updateStatus(rider, 'rejected')} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200">Reject</button></div>}</td>
              </tr>
            ))}
            {!loading && applications.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">No rider applications yet.</td></tr>}
            {loading && <tr><td colSpan={5} className="p-8 text-center text-sm text-slate-500">Loading applications...</td></tr>}
          </tbody>
        </table>
      </div>

      <section className="space-y-3 pt-4">
        <div><h3 className="text-base font-bold text-slate-900 dark:text-white">Salary withdrawal requests</h3><p className="text-xs text-slate-500 dark:text-zinc-400">Complete the external payout before marking it paid.</p></div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-[#12161D]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-[#181F2A] dark:text-zinc-400"><tr><th className="p-3">Rider</th><th className="p-3">Amount</th><th className="p-3">Method / Account</th><th className="p-3">Requested</th><th className="p-3 text-right">Payout</th></tr></thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
              {withdrawals.map((withdrawal) => <tr key={withdrawal.id}><td className="p-3 font-semibold text-slate-900 dark:text-white">{withdrawal.rider_name}</td><td className="p-3 font-bold text-slate-900 dark:text-white">৳{Number(withdrawal.amount).toLocaleString()}</td><td className="p-3 text-slate-700 dark:text-zinc-300">{withdrawal.payout_method}<span className="mt-0.5 block break-all text-xs text-slate-500">{withdrawal.payout_account}</span></td><td className="p-3 text-xs text-slate-500">{new Date(withdrawal.requested_at).toLocaleString()}</td><td className="p-3 text-right"><div className="inline-flex gap-2"><button type="button" disabled={busyWithdrawalId === withdrawal.id} onClick={() => void processWithdrawal(withdrawal, 'rejected')} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200">Reject</button><button type="button" disabled={busyWithdrawalId === withdrawal.id} onClick={() => void processWithdrawal(withdrawal, 'paid')} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{busyWithdrawalId === withdrawal.id ? 'Saving...' : 'Mark paid'}</button></div></td></tr>)}
              {!withdrawals.length && <tr><td colSpan={5} className="p-6 text-center text-sm text-slate-500">No pending withdrawals.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 p-4" onClick={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="rider-review-title" className="w-full max-w-xl space-y-5 rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#12161D]">
            <header className="flex items-start justify-between gap-4"><div><h3 id="rider-review-title" className="text-lg font-bold text-slate-900 dark:text-white">{selected.Name}</h3><p className="text-xs text-slate-500">{selected.Email} · {selected.Number}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Close details" className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button></header>
            <div className="max-h-[55vh] space-y-4 overflow-y-auto text-sm">
              <div><h4 className="mb-1 text-xs font-bold uppercase text-slate-500">Present address</h4><p className="text-slate-800 dark:text-zinc-200">{Object.values(selected.Present_Address || {}).filter(Boolean).join(', ') || 'Not supplied'}</p></div>
              <div><h4 className="mb-1 text-xs font-bold uppercase text-slate-500">Permanent address</h4><p className="text-slate-800 dark:text-zinc-200">{Object.values(selected.Permanent_Address || {}).filter(Boolean).join(', ') || 'Not supplied'}</p></div>
              {[['Experience', selected.Experience], ['Previous jobs', selected.Previous_Jobs], ['Education', selected.Education]].map(([title, lines]) => <div key={title as string}><h4 className="mb-1 text-xs font-bold uppercase text-slate-500">{title as string}</h4><ul className="list-inside list-disc space-y-1 text-slate-800 dark:text-zinc-200">{(lines as string[]).length ? (lines as string[]).map((line) => <li key={line}>{line}</li>) : <li className="list-none text-slate-500">Not supplied</li>}</ul></div>)}
            </div>
            <footer className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-zinc-800">
              {selected.Has_CV && <button type="button" onClick={() => void downloadCv(selected)} className="mr-auto inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-zinc-700"><Download className="h-4 w-4" />Download CV</button>}
              {selected.Status === 'pending' && <><button type="button" onClick={() => void updateStatus(selected, 'rejected')} disabled={busyId === selected.Rider_ID} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold dark:border-zinc-700">Reject</button><button type="button" onClick={() => void updateStatus(selected, 'approved')} disabled={busyId === selected.Rider_ID} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busyId === selected.Rider_ID ? 'Updating...' : 'Approve rider'}</button></>}
            </footer>
          </section>
        </div>
      )}
    </section>
  );
};