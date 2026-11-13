import React from 'react';
import { BUSINESS } from './business';
import { POLICIES, policyByPath, type Policy } from './policies';
import { POLICY_TRANSLATIONS } from './policyTranslations';
import { Languages } from 'lucide-react';
import { useLocale } from '../../lib/i18n';
import { MAIN_CONTENT_ID } from '../SkipLink';

interface LegalPageProps {
  policy?: Policy;
}

/** Standalone, public policy page. Rendered by main.tsx for /terms, /privacy, /refunds and /delivery. */
export const LegalPage: React.FC<LegalPageProps> = ({ policy: propPolicy }) => {
  const policy = propPolicy ?? (typeof window !== 'undefined' ? policyByPath(window.location.pathname) : undefined) ?? POLICIES[0];
  const { t, locale, setLocale } = useLocale();
  const localizedPolicy = locale === 'bn' ? POLICY_TRANSLATIONS[policy.id] : policy;
  const updatedAt = locale === 'bn'
    ? new Date(BUSINESS.lastUpdated).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' })
    : BUSINESS.lastUpdated;

  React.useEffect(() => {
    const previous = document.title;
    document.title = `${localizedPolicy.title} | ${BUSINESS.name}`;
    return () => {
      document.title = previous;
    };
  }, [localizedPolicy]);

  return (
    <div className="min-h-screen bg-surface-50 text-surface-800 dark:bg-[#0C1014] dark:text-surface-200">
      <header className="border-b border-surface-200 bg-white dark:border-surface-800 dark:bg-[#11161C]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <a href="/" className="text-lg font-extrabold tracking-tight text-surface-900 dark:text-white">
            {BUSINESS.name}
          </a>
          <nav aria-label={t('policies')} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {POLICIES.map((item) => (
              <a
                key={item.id}
                href={item.path}
                aria-current={item.id === policy.id ? 'page' : undefined}
                className={
                  item.id === policy.id
                    ? 'font-bold text-brand-600 dark:text-brand-400'
                    : 'text-surface-600 hover:text-brand-600 dark:text-surface-400 dark:hover:text-brand-400'
                }
              >
                {locale === 'bn' ? POLICY_TRANSLATIONS[item.id].title : item.title}
              </a>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => setLocale(locale === 'en' ? 'bn' : 'en')}
            aria-label={`${locale === 'en' ? 'বাংলা' : 'English'} (${t('changeLanguage')})`}
            title={t('changeLanguage')}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-surface-200 px-3 text-xs font-bold text-surface-700 transition-colors hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            <Languages aria-hidden="true" className="h-4 w-4" />
            {locale === 'en' ? 'বাংলা' : 'English'}
          </button>
        </div>
      </header>

      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="mx-auto max-w-3xl px-4 py-8 focus:outline-none">
        {BUSINESS.showDraftBanner && (
          <p
            role="note"
            className="mb-6 rounded-lg border border-warning-300 bg-warning-50 px-3 py-2 text-xs text-warning-900 dark:border-warning-700 dark:bg-warning-950 dark:text-warning-200"
          >
            {t('draftAwaitingLegalReview')}
          </p>
        )}
        {locale === 'bn' && (
          <p role="note" className="mb-4 rounded-lg border border-surface-200 bg-white px-3 py-2 text-xs text-surface-600 dark:border-surface-700 dark:bg-[#11161C] dark:text-surface-300">
            {t('unofficialPolicyTranslation')}
          </p>
        )}
        <h1 className="text-3xl font-black tracking-tight text-surface-900 dark:text-white">{localizedPolicy.title}</h1>
        <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
          {localizedPolicy.summary} {t('lastUpdated')} {updatedAt}.
        </p>

        <div className="mt-8 space-y-7">
          {localizedPolicy.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-bold text-surface-900 dark:text-white">{section.heading}</h2>
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

      <footer className="border-t border-surface-200 px-4 py-6 text-center text-xs text-surface-500 dark:border-surface-800 dark:text-surface-400">
        © {new Date().getFullYear()} {BUSINESS.name} · {locale === 'bn' ? BUSINESS.addressBn : BUSINESS.address} · {BUSINESS.supportEmail}
      </footer>
    </div>
  );
};

export default LegalPage;
