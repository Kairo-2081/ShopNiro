import React from 'react';
import { POLICIES, type PolicyId } from './policies';

interface PolicyLinksProps {
  ids?: PolicyId[];
  className?: string;
}

/** Inline links to policy pages. They open in a new tab so a half-filled form is never lost. */
export const PolicyLinks: React.FC<PolicyLinksProps> = ({ ids, className }) => {
  const items = POLICIES.filter((policy) => !ids || ids.includes(policy.id));
  return (
    <>
      {items.map((policy, index) => (
        <React.Fragment key={policy.id}>
          {index > 0 && (index === items.length - 1 ? ' and ' : ', ')}
          <a
            href={policy.path}
            target="_blank"
            rel="noopener noreferrer"
            className={className ?? 'font-semibold text-blue-600 underline dark:text-sky-400'}
          >
            {policy.title}
          </a>
        </React.Fragment>
      ))}
    </>
  );
};
