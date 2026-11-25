// Transactional email sender for OTP verification via Brevo
// In non-production dev without BREVO_API_KEY, logs the OTP to stdout so local testing works

const parseFromHeader = (rawFrom: string): { name: string; email: string } => {
  const match = rawFrom.match(/^(.*)<([^>]+)>$/);
  if (match) {
    return {
      name: match[1].trim().replace(/^["']|["']$/g, '') || 'DeepChat',
      email: match[2].trim()
    };
  }
  return { name: 'DeepChat', email: rawFrom.trim() };
};

export interface SendOtpEmailParams {
  toEmail: string;
  code: string;
  expiresMinutes: number;
  purpose?: 'auth' | 'reset';
}

const DEEPSIA_LOGO_DATA_URI =
  'data:image/png;base64,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';

const DEFAULT_SENDER = 'DeepChat <noreply@deepsia.my.id>';

export const sendOtpEmail = async ({
  toEmail,
  code,
  expiresMinutes,
  purpose = 'auth'
}: SendOtpEmailParams): Promise<{ provider: 'brevo' | 'dev-console' }> => {
  const rawFrom = process.env.EMAIL_FROM?.trim() || DEFAULT_SENDER;
  const isReset = purpose === 'reset';
  const subject = isReset
    ? `${code} is your DeepChat password reset code`
    : `${code} is your DeepChat verification code`;
  const heading = isReset ? 'Reset your password.' : 'Verify your email.';
  const intro = isReset
    ? 'Use the verification code below to reset your DeepChat password and regain access to your account.'
    : 'Enter the verification code below to continue signing in to your DeepChat account.';
  const codeLabel = isReset ? 'Password Reset Code' : 'Verification Code';

  const textContent = [
    isReset
      ? `Your DeepChat password reset code is: ${code}`
      : `Your DeepChat verification code is: ${code}`,
    '',
    `This code expires in ${expiresMinutes} minutes.`,
    'If you did not request this code, you can safely ignore this email.',
    '',
    'The Deepsia Team'
  ].join('\n');

  const htmlContent = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${subject}</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    @media (prefers-color-scheme: dark) {
      .dc-email-body { background-color: #0b0d11 !important; }
      .dc-email-card { background-color: #13161c !important; border-color: #262a34 !important; }
      .dc-email-header { border-bottom-color: #222630 !important; }
      .dc-email-footer { background-color: #0f1217 !important; border-top-color: #222630 !important; }
      .dc-email-box { background-color: #0f1217 !important; border-color: #262a34 !important; }
      .dc-email-strong { color: #f4f4f5 !important; }
      .dc-email-text { color: #d4d4d8 !important; }
      .dc-email-muted { color: #9ca3af !important; }
      .dc-email-logo { filter: invert(1) brightness(1.08) !important; }
    }
    [data-ogsc] .dc-email-body { background-color: #0b0d11 !important; }
    [data-ogsc] .dc-email-card { background-color: #13161c !important; border-color: #262a34 !important; }
    [data-ogsc] .dc-email-header { border-bottom-color: #222630 !important; }
    [data-ogsc] .dc-email-footer { background-color: #0f1217 !important; border-top-color: #222630 !important; }
    [data-ogsc] .dc-email-box { background-color: #0f1217 !important; border-color: #262a34 !important; }
    [data-ogsc] .dc-email-strong { color: #f4f4f5 !important; }
    [data-ogsc] .dc-email-text { color: #d4d4d8 !important; }
    [data-ogsc] .dc-email-muted { color: #9ca3af !important; }
    [data-ogsc] .dc-email-logo { filter: invert(1) brightness(1.08) !important; }
  </style>
</head>
<body class="dc-email-body" style="margin:0; padding:24px 12px; background-color:#f7f8fa;">
<div class="dc-email-card" style="max-width:600px; margin:0 auto; background-color:#ffffff; border:1px solid #e2e5ea; border-radius:16px; overflow:hidden; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div class="dc-email-header" style="padding:26px 34px 20px 34px; border-bottom:1px solid #eef0f3;">
    <a href="https://www.deepsia.my.id/" target="_blank" style="text-decoration:none; color:#09090b;">
      <img class="dc-email-logo" src="${DEEPSIA_LOGO_DATA_URI}" width="44" height="44" alt="Deepsia" style="display:inline-block; vertical-align:middle; width:44px; height:44px; margin-right:12px; border:0;" />
      <span class="dc-email-strong" style="font-size:21px; font-weight:600; letter-spacing:-0.03em; color:#09090b; vertical-align:middle;">Deepsia</span>
    </a>
  </div>
  <div style="padding:32px 34px;">
    <h1 class="dc-email-strong" style="margin:0 0 18px 0; font-size:26px; font-weight:600; line-height:1.22; letter-spacing:-0.03em; color:#09090b;">
      ${heading}
    </h1>
    <p class="dc-email-text" style="margin:0 0 14px 0; font-size:15px; line-height:1.68; color:#3f3f46;">
      Hi there,
    </p>
    <p class="dc-email-text" style="margin:0 0 24px 0; font-size:15px; line-height:1.68; color:#3f3f46;">
      ${intro}
    </p>
    <div class="dc-email-box" style="background-color:#f7f8fa; border:1px solid #e2e5ea; border-radius:12px; padding:22px 24px; margin:0 0 24px 0; text-align:center;">
      <p class="dc-email-muted" style="margin:0 0 10px 0; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size:11px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:#6b7280;">
        ${codeLabel}
      </p>
      <p class="dc-email-strong" style="margin:0 0 10px 0; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size:34px; font-weight:700; letter-spacing:0.22em; line-height:1.2; color:#09090b;">
        ${code}
      </p>
      <p class="dc-email-muted" style="margin:0; font-size:12px; line-height:1.5; color:#6b7280;">
        Expires in ${expiresMinutes} minutes
      </p>
    </div>
    <p class="dc-email-text" style="margin:0 0 14px 0; font-size:14px; line-height:1.65; color:#3f3f46;">
      If you did not request this code, you can safely ignore this email. No changes were made to your account.
    </p>
    <p class="dc-email-strong" style="margin:0; font-size:14px; line-height:1.65; color:#09090b; font-weight:600;">
      The Deepsia Team
    </p>
  </div>
  <div class="dc-email-footer" style="padding:20px 34px 24px 34px; background-color:#f7f8fa; border-top:1px solid #eef0f3;">
    <p class="dc-email-muted" style="margin:0 0 8px 0; font-size:12px; line-height:1.6; color:#6b7280;">
      <a class="dc-email-strong" href="https://www.deepsia.my.id/" target="_blank" style="color:#09090b; text-decoration:none; font-weight:600;">Deepsia</a> &nbsp;&middot;&nbsp;
      <a class="dc-email-muted" href="https://chat.deepsia.my.id" target="_blank" style="color:#6b7280; text-decoration:none;">DeepChat</a> &nbsp;&middot;&nbsp;
      <a class="dc-email-muted" href="https://www.deepsia.my.id/blog" target="_blank" style="color:#6b7280; text-decoration:none;">Blog</a> &nbsp;&middot;&nbsp;
      <a class="dc-email-muted" href="https://www.deepsia.my.id/policy" target="_blank" style="color:#6b7280; text-decoration:none;">Terms of Services</a>
    </p>
    <p class="dc-email-muted" style="margin:0 0 6px 0; font-size:12px; line-height:1.55; color:#6b7280;">
      To keep meaningful technology free whenever we can, and make it clear enough for everyone to understand and use.
    </p>
    <p class="dc-email-muted" style="margin:0; font-size:11px; color:#6b7280;">
      &copy; 2026 Deepsia. All rights reserved.
    </p>
  </div>
</div>
</body>
</html>`;

  const brevoKey = process.env.BREVO_API_KEY?.trim();
  if (brevoKey) {
    const sender = parseFromHeader(rawFrom);
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'api-key': brevoKey
      },
      body: JSON.stringify({
        sender,
        to: [{ email: toEmail }],
        subject,
        textContent,
        htmlContent
      })
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Brevo email failed (${res.status}): ${errText.slice(0, 200)}`);
    }
    return { provider: 'brevo' };
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info(`[deepchat-otp] Dev OTP for ${toEmail} (from ${rawFrom}): ${code}`);
    return { provider: 'dev-console' };
  }

  throw new Error('Email OTP provider is not configured. Set BREVO_API_KEY.');
};
