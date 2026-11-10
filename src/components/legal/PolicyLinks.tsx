import React from 'react';
import { POLICY_NAV, type PolicyId } from './policyNav';
import { useLocale } from '../../lib/i18n';

interface PolicyLinksProps {
  ids?: PolicyId[];
  className?: string;
}

/** Inline links to policy pages. They open in a new tab so a half-filled form is never lost. */
export const PolicyLinks: React.FC<PolicyLinksProps> = ({ ids, className }) => {
  const { t, locale } = useLocale();
  const items = POLICY_NAV.filter((policy) => !ids || ids.includes(policy.id));
  return (
    <>
      {items.map((policy, index) => (
        <React.Fragment key={policy.id}>
          {index > 0 && (index === items.length - 1 ? (locale === 'bn' ? ' ও ' : ' and ') : ', ')}
          <a
            href={policy.path}
            target="_blank"
            rel="noopener noreferrer"
            className={className ?? 'font-semibold text-brand-600 underline dark:text-brand-400'}
          >
            {t(policy.titleKey)}
          </a>
        </React.Fragment>
      ))}
    </>
  );
};
