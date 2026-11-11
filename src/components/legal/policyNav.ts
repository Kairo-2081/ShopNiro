import { type MessageKey } from '../../lib/i18n';

export type PolicyId = 'terms' | 'privacy' | 'refunds' | 'delivery';

export interface PolicyNavItem {
  id: PolicyId;
  path: string;
  titleKey: MessageKey;
  defaultTitle: string;
}

export const POLICY_NAV: PolicyNavItem[] = [
  { id: 'terms', path: '/terms', titleKey: 'termsOfService', defaultTitle: 'Terms of Service' },
  { id: 'privacy', path: '/privacy', titleKey: 'privacyPolicy', defaultTitle: 'Privacy Policy' },
  { id: 'refunds', path: '/refunds', titleKey: 'refundPolicy', defaultTitle: 'Refund Policy' },
  { id: 'delivery', path: '/delivery', titleKey: 'deliveryPolicy', defaultTitle: 'Delivery Policy' },
];
