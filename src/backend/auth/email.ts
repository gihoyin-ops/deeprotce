// Transactional email sender for OTP verification via Brevo.
// In non-production dev without BREVO_API_KEY, logs the OTP to stdout so local testing works.

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

const BRAND_LOGO_URL = 'https://cdn.deepsia.my.id/brands/deepsia-with-name_pg.png';
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
  const heading = isReset ? 'Reset your DeepChat password' : 'Sign in to DeepChat';
  const intro = isReset
    ? 'Enter the verification code below to reset your password:'
    : 'Enter the verification code below to continue:';
  const textContent = [
    isReset
      ? `Your DeepChat password reset code is: ${code}`
      : `Your DeepChat verification code is: ${code}`,
    '',
    `This code expires in ${expiresMinutes} minutes.`,
    'If you did not request this code, you can safely ignore this email.'
  ].join('\n');

  const logoBlock = `<img src="${BRAND_LOGO_URL}" alt="DeepChat" height="32" style="display: block; height: 32px; width: auto; margin-bottom: 18px;" />`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 460px; margin: 0 auto; padding: 28px 24px; color: #111827; border: 1px solid #e5e7eb; border-radius: 16px;">
      ${logoBlock}
      <h2 style="margin: 0 0 10px; font-size: 20px; font-weight: 600;">${heading}</h2>
      <p style="margin: 0 0 20px; font-size: 14px; color: #4b5563;">${intro}</p>
      <div style="background: #f3f4f6; border-radius: 12px; padding: 18px; text-align: center; letter-spacing: 6px; font-size: 28px; font-weight: 700; color: #111827;">
        ${code}
      </div>
      <p style="margin: 20px 0 0; font-size: 12px; color: #6b7280;">
        This code expires in ${expiresMinutes} minutes. If you didn&apos;t request this email, you can safely ignore it.
      </p>
    </div>
  `.trim();

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
