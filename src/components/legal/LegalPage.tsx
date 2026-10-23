import React from 'react';
import { BUSINESS } from './business';
import { POLICIES, type Policy } from './policies';

interface LegalPageProps {
  policy: Policy;
}

/** Standalone, public policy page. Rendered by main.tsx for /terms, /privacy, /refunds and /delivery. */
export const LegalPage: React.FC<LegalPageProps> = ({ policy }) => {
  React.useEffect(() => {
    const previous = document.title;
    document.title = `${policy.title} | ${BUSINESS.name}`;
    return () => {
      document.title = previous;
    };
  }, [policy]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 dark:bg-[#0C1014] dark:text-zinc-200">
      <header className="border-b border-slate-200 bg-white dark:border-zinc-800 dark:bg-[#11161C]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <a href="/" className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            {BUSINESS.name}
          </a>
          <nav aria-label="Policies" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {POLICIES.map((item) => (
              <a
                key={item.id}
                href={item.path}
                aria-current={item.id === policy.id ? 'page' : undefined}
                className={
                  item.id === policy.id
                    ? 'font-bold text-blue-600 dark:text-sky-400'
                    : 'text-slate-600 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-sky-400'
                }
              >
                {item.title}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {BUSINESS.showDraftBanner && (
          <p
            role="note"
            className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          >
            This policy is a working draft and is awaiting legal review.
          </p>
        )}
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{policy.title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
          {policy.summary} Last updated {BUSINESS.lastUpdated}.
        </p>

        <div className="mt-8 space-y-7">
          {policy.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{section.heading}</h2>
              {section.paragraphs?.map((text) => (
                <p key={text} className="mt-2 text-sm leading-relaxed">
                  {text}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                  {section.bullets.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-slate-200 px-4 py-6 text-center text-xs text-slate-500 dark:border-zinc-800 dark:text-zinc-400">
        © {new Date().getFullYear()} {BUSINESS.name} · {BUSINESS.address} · {BUSINESS.supportEmail}
      </footer>
    </div>
  );
};

export default LegalPage;
