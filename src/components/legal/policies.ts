import { BUSINESS as B } from './business';

export type PolicyId = 'terms' | 'privacy' | 'refunds' | 'delivery';

export interface PolicySection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface Policy {
  id: PolicyId;
  path: string;
  title: string;
  summary: string;
  sections: PolicySection[];
}

const contact = `Questions about this policy: ${B.supportEmail}.`;

export const POLICIES: Policy[] = [
  {
    id: 'terms',
    path: '/terms',
    title: 'Terms of Service',
    summary: 'The rules for using ShopNiro as a customer, seller or rider.',
    sections: [
      {
        heading: '1. Who we are and what these terms cover',
        paragraphs: [
          `${B.name} ("ShopNiro", "we", "us") runs an online marketplace at ${B.siteUrl} where independent sellers list products, customers buy them, and riders deliver them. By creating an account or placing an order you agree to these terms, our Privacy Policy, our Refund and Return Policy and our Delivery Policy.`,
          'You must be at least 18 years old, or use ShopNiro under the supervision of a parent or guardian who accepts these terms for you.',
        ],
      },
      {
        heading: '2. ShopNiro is a marketplace',
        paragraphs: [
          'Products are sold by independent sellers, not by ShopNiro. When you place an order, the sale is between you and the seller. ShopNiro provides the platform, collects payment on the seller\'s behalf, coordinates delivery and handles support and refunds as described in our policies.',
          'We try to keep listings accurate, but descriptions, images and stock levels are supplied by sellers.',
        ],
      },
      {
        heading: '3. Accounts',
        bullets: [
          'Give accurate information and keep your password private. You are responsible for activity on your account.',
          'Tell us promptly at the support address if you think someone else has used your account.',
          'Seller and rider accounts are approved by us after we review the details and documents you submit. We may refuse, suspend or close an account that gives false information or breaks these terms.',
        ],
      },
      {
        heading: '4. Prices, orders and payment',
        bullets: [
          'Prices are in Bangladeshi Taka (BDT). The total you pay, including any delivery fee and discount, is shown at checkout before you confirm.',
          'An order is accepted when the payment is confirmed (online payments) or when the order is placed (cash on delivery). We may cancel an order if an item is out of stock, mispriced, or the order looks fraudulent, and we will refund anything you have already paid.',
          `Online payments are processed by SSLCOMMERZ. ShopNiro does not see or store your card or mobile-wallet credentials. An online order that is not paid within ${B.unpaidOnlineOrderMinutes} minutes is cancelled automatically and its stock is released.`,
          'Cash-on-delivery orders must be paid in full to the rider when the order arrives.',
        ],
      },
      {
        heading: '5. Cancellations, returns and refunds',
        paragraphs: ['These are covered in the Refund and Return Policy, which forms part of these terms.'],
      },
      {
        heading: '6. Seller terms',
        bullets: [
          'Sellers must be entitled to sell what they list, describe products truthfully, keep stock accurate, and dispatch orders promptly.',
          'Prohibited items include anything illegal in Bangladesh, counterfeit goods, stolen goods, weapons, controlled or prescription drugs, and anything we reasonably decide is unsafe.',
          `ShopNiro charges a commission on each completed sale (currently ${B.sellerCommissionPercent}% of the product subtotal). Seller earnings are held for ${B.sellerPayoutHoldDays} days after delivery before they become payable, so that returns and disputes can be settled. We may deduct refunds and chargebacks that result from the seller's order.`,
          'Sellers must give the verification documents we ask for. We store them securely and use them only to verify and manage the seller account.',
        ],
      },
      {
        heading: '7. Rider terms',
        bullets: [
          'Riders must follow the delivery instructions in the app, handle parcels with care, and collect cash on delivery only for the amount shown on the order.',
          'Location sharing is required while a delivery is active so customers can track it.',
        ],
      },
      {
        heading: '8. Acceptable use',
        bullets: [
          'Do not misuse the service: no fraud, scraping, probing for security weaknesses, bypassing payment, posting unlawful or abusive content, or interfering with other users.',
          'Reviews must be honest and based on your own experience.',
        ],
      },
      {
        heading: '9. Our liability',
        paragraphs: [
          'We provide the platform with reasonable care, but we cannot promise it will always be available or error-free. To the extent the law allows, ShopNiro is not liable for indirect losses, and our liability for any order is limited to the amount you paid for it. Nothing in these terms limits rights you have under consumer protection law that cannot be excluded.',
        ],
      },
      {
        heading: '10. Changes, suspension and governing law',
        paragraphs: [
          'We may update these terms; the date at the top shows the latest version, and continued use means you accept the update. We may suspend or end access for breach of these terms.',
          'These terms are governed by the laws of Bangladesh, and the courts of Dhaka have jurisdiction, without affecting any right you have to bring a consumer complaint to the competent authority.',
        ],
      },
      { heading: '11. Contact', paragraphs: [`${B.name}, ${B.address}. Email: ${B.supportEmail}.`] },
    ],
  },
  {
    id: 'privacy',
    path: '/privacy',
    title: 'Privacy Policy',
    summary: 'What personal data ShopNiro collects, why, who sees it, and your choices.',
    sections: [
      {
        heading: '1. Who is responsible',
        paragraphs: [`${B.name} (${B.address}) is the controller of the personal data described here. Contact: ${B.supportEmail}.`],
      },
      {
        heading: '2. What we collect',
        bullets: [
          'Account data: username or email address, a password stored only as a salted hash, your role (customer, seller or rider), and optional profile details.',
          'Order data: items, delivery name, phone number and address, order status and history, payment status and the transaction reference returned by the payment gateway.',
          'Location: delivery coordinates you choose, and a rider\'s live location while a delivery is active so the customer can track it.',
          'Seller and rider verification data: business or identity details and the documents you upload. Seller documents are kept in a private store that is not publicly accessible.',
          'Messages: support requests, reviews, and the messages you send to the AI shopping assistant.',
          'Technical data: IP address, browser type and error logs, used for security, abuse prevention and fixing faults.',
          'If you sign in with Google or Facebook, we receive your verified email address and basic profile from that provider.',
        ],
      },
      {
        heading: '3. How we use it',
        bullets: [
          'To create your account, process and deliver orders, take payments and issue refunds.',
          'To let sellers fulfil your order and riders deliver it.',
          'To prevent fraud and abuse, keep the service secure, and meet legal obligations.',
          'To answer support requests and, if you opt in, send the welcome-offer email.',
          'We do not sell your personal data.',
        ],
      },
      {
        heading: '4. Who we share it with',
        bullets: [
          'The seller of your order sees your name, delivery address, phone number and the items ordered. The assigned rider sees what is needed to deliver and collect payment.',
          'SSLCOMMERZ processes online payments under its own privacy terms.',
          'Service providers that run ShopNiro for us: Supabase (database and file storage), Render (hosting), Resend (email), Sentry (error monitoring) and Groq (the AI assistant, which receives the text of your assistant conversations). Maps use OpenStreetMap and OSRM; sign-in uses Google and Facebook if you choose them.',
          'Authorities, when the law requires it.',
        ],
      },
      {
        heading: '5. Cookies',
        paragraphs: [
          'We use a single strictly necessary session cookie to keep you signed in; it expires after one hour of use. We do not use advertising or cross-site tracking cookies. Your browser may also store display preferences such as light or dark theme.',
        ],
      },
      {
        heading: '6. How long we keep data',
        bullets: [
          'Account data is kept while your account is open.',
          'Order and payment records are kept for as long as needed for accounting, tax, refunds and dispute handling.',
          'Seller verification documents are kept while the seller account is active and for a reasonable period afterwards.',
          'Encrypted backups of our database are kept for about 30 days.',
        ],
      },
      {
        heading: '7. Security',
        paragraphs: [
          'Connections use HTTPS, passwords are hashed, access is checked on the server for every request, and database backups are encrypted. No system is perfectly secure; if a breach affects you we will tell you as the law requires.',
        ],
      },
      {
        heading: '8. Your choices',
        paragraphs: [
          `You can ask us to access, correct or delete your personal data, or withdraw consent to optional emails, by writing to ${B.supportEmail}. We may keep data we are legally required to keep, such as order and payment records.`,
        ],
      },
      {
        heading: '9. Children',
        paragraphs: ['ShopNiro is not intended for people under 18 acting on their own. If you believe a child has given us data, contact us and we will delete it.'],
      },
      {
        heading: '10. Changes',
        paragraphs: ['We will update this page when our practices change and show the new date at the top.'],
      },
    ],
  },
  {
    id: 'refunds',
    path: '/refunds',
    title: 'Refund and Return Policy',
    summary: 'When you can cancel, return an item, and how refunds are paid.',
    sections: [
      {
        heading: '1. Cancelling an order',
        bullets: [
          `An online order that is not paid within ${B.unpaidOnlineOrderMinutes} minutes is cancelled automatically.`,
          'To cancel a paid or cash-on-delivery order, use "Request cancellation" on the order in your account. Cancellation can be requested only before any part of the order ships, and each request is reviewed. Once an order has shipped you can refuse it at the door instead (see section 3).',
          'If we cancel an order (for example, the item is out of stock), you are refunded in full.',
        ],
      },
      {
        heading: '2. Returns',
        paragraphs: [
          'Each product page shows the seller\'s return policy for that item. Unless the listing says otherwise, you may ask for a return or replacement if the item arrives damaged, defective, not as described, or is the wrong item. Report it through Support from your order within 3 days of delivery, with photos where relevant.',
          'Items must be unused and in their original packaging unless the problem is a defect. Some goods (for example opened hygiene products or perishable items) may not be returnable; the listing will say so.',
        ],
      },
      {
        heading: '3. Refusing a delivery',
        paragraphs: ['If a parcel is visibly damaged or is not what you ordered, you may refuse it from the rider and tell Support, who will arrange a refund or replacement.'],
      },
      {
        heading: '4. How refunds are paid',
        bullets: [
          'Online payments are refunded to the original payment method through SSLCOMMERZ. After a refund is approved it normally reaches you within ' + B.refundBusinessDays + ' business days, depending on your bank or mobile wallet.',
          'Cash-on-delivery refunds are arranged with Support using a mobile wallet or bank transfer.',
          'If you were charged twice for the same order, the duplicate payment is refunded automatically.',
          'Delivery fees are refunded when the order was cancelled by us or the item was faulty or wrong.',
        ],
      },
      {
        heading: '5. If something goes wrong',
        paragraphs: [`Write to ${B.supportEmail} or use Support in the app with your order number. We will review the case with the seller and reply with a decision.`],
      },
    ],
  },
  {
    id: 'delivery',
    path: '/delivery',
    title: 'Delivery Policy',
    summary: 'Delivery fees, timing, tracking and what happens if a delivery fails.',
    sections: [
      {
        heading: '1. Where we deliver',
        paragraphs: ['We deliver to addresses in areas covered by our riders. If your address is outside our coverage, checkout will tell you before you pay.'],
      },
      {
        heading: '2. Delivery fees',
        paragraphs: [`The delivery fee is shown at checkout before you confirm. Delivery is free when the product subtotal is ৳${B.freeShippingThresholdBDT} or more.`],
      },
      {
        heading: '3. Timing and tracking',
        bullets: [
          'Delivery times shown are estimates, not guarantees. Sellers dispatch orders after payment is confirmed (or after the order is placed for cash on delivery).',
          'You can follow your order status and, once a rider is assigned, its live location from your account.',
        ],
      },
      {
        heading: '4. Receiving your order',
        bullets: [
          'Make sure the phone number and address are correct; the rider may call you.',
          'For cash on delivery, please have the exact amount ready.',
          'Check the parcel before the rider leaves. If it is damaged, refuse it and contact Support (see the Refund and Return Policy).',
        ],
      },
      {
        heading: '5. Failed delivery',
        paragraphs: ['If nobody is reachable at the address after reasonable attempts, the order may be returned to the seller. Online-paid orders are then refunded to you, less any delivery fee we are entitled to keep where the failure was your fault.'],
      },
      { heading: '6. Contact', paragraphs: [contact] },
    ],
  },
];

export const policyByPath = (pathname: string): Policy | undefined => {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return POLICIES.find((policy) => policy.path === clean);
};
