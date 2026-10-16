// STRAYMUTANT.DEV — Tamak Bookshop
// Sends the app's own emails (receipts). Server only.
//
// Uses Brevo's HTTP API, so there is nothing to install. To switch provider later,
// only this file changes. Needs these environment variables (Vercel + .env.local):
//   BREVO_API_KEY    an API key from Brevo (SMTP & API -> API Keys), NOT the SMTP key
//   EMAIL_FROM       a sender Brevo has verified, e.g. no-reply@tamakbookshop.com
//   EMAIL_FROM_NAME  optional, defaults to "Tamak Bookshop"
// If BREVO_API_KEY is missing, emails are skipped (and logged); orders are never blocked.

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Empty -> null. A non-empty value that is not an email address throws a friendly error. */
export function parseEmail(value: unknown): string | null {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email) return null;
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    throw new Error('Enter a valid email address, e.g. name@example.com');
  }
  return email;
}

export interface SendResult {
  ok: boolean;
  skipped?: string;
  error?: string;
}

export async function sendEmail(input: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  if (!apiKey || !fromEmail) {
    console.warn('[email] BREVO_API_KEY or EMAIL_FROM is not set; email skipped:', input.subject);
    return { ok: false, skipped: 'not-configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(BREVO_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { name: process.env.EMAIL_FROM_NAME || 'Tamak Bookshop', email: fromEmail },
        to: [{ email: input.to, ...(input.toName ? { name: input.toName } : {}) }],
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[email] Brevo rejected the email:', res.status, body.slice(0, 300));
      return { ok: false, error: `Brevo ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('[email] could not reach Brevo:', e);
    return { ok: false, error: e instanceof Error ? e.message : 'send failed' };
  } finally {
    clearTimeout(timer);
  }
}