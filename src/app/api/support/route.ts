import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORT_EMAIL = 'support@deepsia.my.id';
const DEFAULT_SENDER = 'Benthos Support <noreply@deepsia.my.id>';

const parseFromHeader = (rawFrom: string): { name: string; email: string } => {
  const match = rawFrom.match(/^(.*)<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/^["']|["']$/g, '') || 'Benthos Support',
      email: match[2].trim(),
    };
  }
  return { name: 'Benthos Support', email: rawFrom.trim() };
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: unknown;
      message?: unknown;
    };

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (message.length < 5 || message.length > 4000) {
      return NextResponse.json(
        { error: 'Please write a message between 5 and 4000 characters.' },
        { status: 400 }
      );
    }

    const brevoKey = process.env.BREVO_API_KEY?.trim();
    const rawFrom = process.env.EMAIL_FROM?.trim() || DEFAULT_SENDER;
    const sender = parseFromHeader(rawFrom);
    const subject = `[Benthos Support] Message from ${email}`;
    const textContent = `From: ${email}\n\n${message}`;
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111827; border: 1px solid #e5e7eb; border-radius: 16px;">
        <h2 style="margin: 0 0 8px; font-size: 18px; font-weight: 600;">New Support Request</h2>
        <p style="margin: 0 0 16px; font-size: 13px; color: #4b5563;">From: <strong>${escapeHtml(email)}</strong></p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(message)}</div>
      </div>
    `.trim();

    if (brevoKey) {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'api-key': brevoKey,
        },
        body: JSON.stringify({
          sender,
          to: [{ email: SUPPORT_EMAIL }],
          replyTo: { email },
          subject,
          textContent,
          htmlContent,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Support email failed (${res.status}): ${errText.slice(0, 200)}`);
      }
      return NextResponse.json({ ok: true });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.info(`[deepchat-support] -> ${SUPPORT_EMAIL} from ${email}: ${message}`);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: 'Support email service is not configured yet.' },
      { status: 503 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send support message.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
