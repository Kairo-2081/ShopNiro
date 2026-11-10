interface WelcomeOfferRecipient {
  name: string;
  email: string;
}

interface PasswordResetRecipient {
  email: string;
  token: string;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character] || character));

export async function sendWelcomeOfferEmail(recipient: WelcomeOfferRecipient): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SHOPNIRO_FROM_EMAIL;
  const publicUrl = process.env.SHOPNIRO_PUBLIC_URL;
  if (!apiKey || !from || !publicUrl) return false;

  const destination = new URL('/', publicUrl).toString();
  const safeName = escapeHtml(recipient.name);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [recipient.email],
      subject: 'Your ShopNiro NEW20 welcome offer',
      text: `Welcome to ShopNiro, ${recipient.name}. Use NEW20 at checkout for 20% off eligible apparel on your first order. Browse: ${destination}`,
      html: `<main style="font-family:Arial,sans-serif;color:#17202a;line-height:1.6"><h1>Welcome to ShopNiro, ${safeName}</h1><p>Your first-order offer is ready. Use <strong>NEW20</strong> at checkout for 20% off eligible apparel.</p><p><a href="${destination}">Browse ShopNiro</a></p><p style="font-size:12px;color:#667085">Offer applies to eligible apparel and is limited to your first ShopNiro order.</p></main>`,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) throw new Error(`Welcome email provider returned HTTP ${response.status}.`);
  return true;
}

export function isPasswordResetEmailConfigured(): boolean {
  if (!process.env.RESEND_API_KEY || !process.env.SHOPNIRO_FROM_EMAIL || !process.env.SHOPNIRO_PUBLIC_URL) return false;
  try {
    const url = new URL(process.env.SHOPNIRO_PUBLIC_URL);
    return url.protocol === 'https:' || process.env.NODE_ENV !== 'production' && url.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function sendPasswordResetEmail(recipient: PasswordResetRecipient): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SHOPNIRO_FROM_EMAIL;
  const publicUrl = process.env.SHOPNIRO_PUBLIC_URL;
  if (!apiKey || !from || !publicUrl) return false;

  const resetUrl = new URL('/', publicUrl);
  resetUrl.hash = `/reset-password?token=${encodeURIComponent(recipient.token)}`;
  const safeResetUrl = escapeHtml(resetUrl.toString());
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `******`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [recipient.email],
      subject: 'Reset your ShopNiro password',
      text: `We received a request to reset your ShopNiro password. Set a new password here within 30 minutes: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      html: `<main style="font-family:Arial,sans-serif;color:#17202a;line-height:1.6"><h1>Reset your ShopNiro password</h1><p>We received a request to reset your password.</p><p><a href="${safeResetUrl}">Choose a new password</a></p><p>This link expires in 30 minutes and can only be used once. If you did not request this, you can ignore this email.</p></main>`,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) throw new Error(`Password recovery email provider returned HTTP ${response.status}.`);
  return true;
}

export async function sendSupportRequestEmail(request: { name: string; email: string; subject: string; message: string; requestId: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SHOPNIRO_FROM_EMAIL;
  const to = process.env.SHOPNIRO_SUPPORT_EMAIL;
  if (!apiKey || !from || !to) return false;

  const safeName = escapeHtml(request.name);
  const safeEmail = escapeHtml(request.email);
  const safeSubject = escapeHtml(request.subject);
  const safeMessage = escapeHtml(request.message).replace(/\r?\n/g, '<br>');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: request.email,
      subject: `[ShopNiro support ${request.requestId}] ${request.subject}`,
      text: `From: ${request.name} <${request.email}>\nRequest: ${request.requestId}\n\n${request.message}`,
      html: `<main style="font-family:Arial,sans-serif;color:#17202a;line-height:1.6"><h1>${safeSubject}</h1><p>From: ${safeName} &lt;${safeEmail}&gt;</p><p>Request ID: ${escapeHtml(request.requestId)}</p><p>${safeMessage}</p></main>`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Support email provider returned HTTP ${response.status}.`);
  return true;
}
