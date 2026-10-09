interface WelcomeOfferRecipient {
  name: string;
  email: string;
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
