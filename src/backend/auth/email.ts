// Transactional email sender for OTP codes via Brevo.
// In non-prod dev without BREVO_API_KEY, dumps the OTP to stdout so local testing doesn't suck.

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

const DEEPSIA_LOGO_LIGHT_URL = 'https://cdn.deepsia.my.id/brands/deepsia-mark-light.png';
const DEEPSIA_LOGO_DARK_URL = 'https://cdn.deepsia.my.id/brands/deepsia-mark-dark.png';

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
      .dc-email-logo-light { display: none !important; }
      .dc-email-logo-dark { display: inline-block !important; }
    }
    [data-ogsc] .dc-email-body { background-color: #0b0d11 !important; }
    [data-ogsc] .dc-email-card { background-color: #13161c !important; border-color: #262a34 !important; }
    [data-ogsc] .dc-email-header { border-bottom-color: #222630 !important; }
    [data-ogsc] .dc-email-footer { background-color: #0f1217 !important; border-top-color: #222630 !important; }
    [data-ogsc] .dc-email-box { background-color: #0f1217 !important; border-color: #262a34 !important; }
    [data-ogsc] .dc-email-strong { color: #f4f4f5 !important; }
    [data-ogsc] .dc-email-text { color: #d4d4d8 !important; }
    [data-ogsc] .dc-email-muted { color: #9ca3af !important; }
    [data-ogsc] .dc-email-logo-light { display: none !important; }
    [data-ogsc] .dc-email-logo-dark { display: inline-block !important; }
  </style>
</head>
<body class="dc-email-body" style="margin:0; padding:24px 12px; background-color:#f7f8fa;">
<div class="dc-email-card" style="max-width:600px; margin:0 auto; background-color:#ffffff; border:1px solid #e2e5ea; border-radius:16px; overflow:hidden; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div class="dc-email-header" style="padding:26px 34px 20px 34px; border-bottom:1px solid #eef0f3;">
    <a href="https://www.deepsia.my.id/" target="_blank" style="text-decoration:none; color:#09090b;">
      <img class="dc-email-logo-light" src="${DEEPSIA_LOGO_LIGHT_URL}" width="44" height="44" alt="Deepsia" style="display:inline-block; vertical-align:middle; width:44px; height:44px; margin-right:12px; border:0;" />
      <img class="dc-email-logo-dark" src="${DEEPSIA_LOGO_DARK_URL}" width="44" height="44" alt="Deepsia" style="display:none; mso-hide:all; vertical-align:middle; width:44px; height:44px; margin-right:12px; border:0;" />
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
