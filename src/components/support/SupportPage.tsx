import React from 'react';
import { Customer } from '../../types';
import { api } from '../../lib/api';
import { LifeBuoy, Mail, Send, CheckCircle2 } from 'lucide-react';

interface SupportPageProps {
  currentCustomer: Customer | null;
}

export const SupportPage: React.FC<SupportPageProps> = ({ currentCustomer }) => {
  const [name, setName] = React.useState(currentCustomer?.Name || '');
  const [email, setEmail] = React.useState(currentCustomer?.Email || '');
  const [subject, setSubject] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [requestId, setRequestId] = React.useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const result = await api.submitSupportRequest({
        Name: name.trim(),
        Email: email.trim(),
        Subject: subject.trim(),
        Message: message.trim(),
      });
      setRequestId(result.Request_ID);
      setSubject('');
      setMessage('');
    } catch (submitError: any) {
      setError(submitError.message || 'Could not send your support request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 py-4" aria-labelledby="support-title">
      <header className="flex items-start gap-4 border-b border-surface-200 pb-5 dark:border-surface-800">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success-700 text-white"><LifeBuoy className="h-5 w-5" /></span>
        <div>
          <h1 id="support-title" className="text-xl font-bold text-surface-900 dark:text-white">ShopNiro Support</h1>
          <p className="mt-1 text-sm text-surface-600 dark:text-surface-400">Send a request and our team will follow up by email.</p>
        </div>
      </header>

      {requestId ? (
        <div role="status" className="space-y-3 rounded-xl border border-success-300 bg-success-50 p-5 text-success-900 dark:border-success-900 dark:bg-success-950/30 dark:text-success-200">
          <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" />Your support request was received.</p>
          <p className="text-sm">Reference: <span className="font-mono">{requestId}</span></p>
          <button type="button" onClick={() => setRequestId('')} className="text-sm font-semibold underline underline-offset-4">Send another request</button>
        </div>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          {error && <p role="alert" className="rounded-lg border border-danger-300 bg-danger-50 p-3 text-sm text-danger-800 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-200">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-surface-700 dark:text-surface-300">Name
              <input autoComplete="name" required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2.5 text-surface-900 outline-none focus:ring-2 focus:ring-success-600 dark:border-surface-700 dark:bg-[#181F2A] dark:text-white" />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-surface-700 dark:text-surface-300">Email
              <input autoComplete="email" type="email" required maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2.5 text-surface-900 outline-none focus:ring-2 focus:ring-success-600 dark:border-surface-700 dark:bg-[#181F2A] dark:text-white" />
            </label>
          </div>
          <label className="block space-y-1.5 text-sm font-medium text-surface-700 dark:text-surface-300">Subject
            <input required maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2.5 text-surface-900 outline-none focus:ring-2 focus:ring-success-600 dark:border-surface-700 dark:bg-[#181F2A] dark:text-white" />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-surface-700 dark:text-surface-300">How can we help?
            <textarea required minLength={10} maxLength={5000} rows={7} value={message} onChange={(event) => setMessage(event.target.value)} className="w-full resize-y rounded-lg border border-surface-300 bg-white px-3 py-2.5 text-surface-900 outline-none focus:ring-2 focus:ring-success-600 dark:border-surface-700 dark:bg-[#181F2A] dark:text-white" />
            <span className="block text-right text-xs font-normal text-surface-500 dark:text-surface-400">{message.length}/5000</span>
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-200 pt-4 dark:border-surface-800">
            <a href="mailto:shopnirosupport@gmail.com" className="inline-flex items-center gap-2 text-sm font-semibold text-success-800 underline underline-offset-4 dark:text-success-300"><Mail className="h-4 w-4" />shopnirosupport@gmail.com</a>
            <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-lg bg-success-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-success-800 disabled:cursor-wait disabled:opacity-60">
              <Send className="h-4 w-4" />{isSubmitting ? 'Sending…' : 'Send support request'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
};