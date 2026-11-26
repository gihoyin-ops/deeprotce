import crypto from 'node:crypto';
import type { DbPool } from '@/backend/db/connection';
import { hashToken } from '@/lib/security/crypto';

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes before this shit expires
export const OTP_HISTORY_WINDOW_MS = 60 * 60 * 1000; // 1 hour window for resend cooldown escalation
export const OTP_MAX_ATTEMPTS = 5;

export type OtpPurpose = 'auth' | 'reset';

const hashOtpCode = (email: string, purpose: OtpPurpose, code: string): string =>
  hashToken(`${email.trim().toLowerCase()}:${purpose}:${code.trim()}`);

// Progressive cooldown with random jitter as resend spam ramps up within 1 hour:
// 1st send -> next resend in 45s to 60s
// 2nd send -> next resend in 120s to 180s (2 to 3 min)
// 3rd send -> next resend in 300s to 480s (5 to 8 min)
// 4th+ send -> next resend in 600s to 900s (10 to 15 min)
const computeProgressiveCooldownMs = (priorSendsInWindow: number): number => {
  if (priorSendsInWindow <= 0) {
    return (45 + crypto.randomInt(0, 16)) * 1000;
  }
  if (priorSendsInWindow === 1) {
    return (120 + crypto.randomInt(0, 61)) * 1000;
  }
  if (priorSendsInWindow === 2) {
    return (300 + crypto.randomInt(0, 181)) * 1000;
  }
  return (600 + crypto.randomInt(0, 301)) * 1000;
};

export const issueEmailOtp = async (
  pool: DbPool,
  email: string,
  purpose: OtpPurpose = 'auth'
): Promise<{ code: string; resendAfterSeconds: number; retryAfterSeconds?: number }> => {
  const normalizedEmail = email.trim().toLowerCase();
  const now = Date.now();
  const windowCutoffIso = new Date(now - OTP_HISTORY_WINDOW_MS).toISOString();

  // Check if the latest OTP for this email is still on cooldown
  const latestRows = await pool.query<{ next_resend_at: number }>(
    `SELECT next_resend_at FROM email_otps
     WHERE email = ? AND purpose = ?
     ORDER BY created_at DESC LIMIT 1`,
    [normalizedEmail, purpose]
  );

  const latestNextResend = Number(latestRows[0]?.next_resend_at ?? 0);
  if (latestNextResend > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((latestNextResend - now) / 1000));
    return { code: '', resendAfterSeconds: retryAfterSeconds, retryAfterSeconds };
  }

  // Count how many times they spammed sends in the last hour so we can crank up the cooldown with jitter
  const countRows = await pool.query<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM email_otps
     WHERE email = ? AND purpose = ? AND created_at >= ?`,
    [normalizedEmail, purpose, windowCutoffIso]
  );
  const priorSends = Number(countRows[0]?.cnt ?? 0);
  const cooldownMs = computeProgressiveCooldownMs(priorSends);
  const nextResendAt = now + cooldownMs;

  // Nuke any old unconsumed OTPs for this email and purpose
  await pool.exec(
    `UPDATE email_otps SET consumed_at = ? WHERE email = ? AND purpose = ? AND consumed_at IS NULL`,
    [now, normalizedEmail, purpose]
  );

  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = hashOtpCode(normalizedEmail, purpose, code);

  await pool.exec(
    `INSERT INTO email_otps (id, email, purpose, code_hash, attempts, expires_at, next_resend_at, consumed_at, created_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, NULL, ?)`,
    [
      crypto.randomUUID(),
      normalizedEmail,
      purpose,
      codeHash,
      now + OTP_TTL_MS,
      nextResendAt,
      new Date(now).toISOString()
    ]
  );

  return {
    code,
    resendAfterSeconds: Math.ceil(cooldownMs / 1000)
  };
};

export const verifyEmailOtp = async (
  pool: DbPool,
  email: string,
  code: string,
  purpose: OtpPurpose = 'auth'
): Promise<{ ok: true } | { ok: false; error: string; status: number }> => {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();
  const now = Date.now();

  if (!/^\d{6}$/.test(cleanCode)) {
    return { ok: false, error: 'Please enter the 6-digit verification code.', status: 400 };
  }

  const rows = await pool.query<{
    id: string;
    code_hash: string;
    attempts: number;
    expires_at: number;
  }>(
    `SELECT id, code_hash, attempts, expires_at FROM email_otps
     WHERE email = ? AND purpose = ? AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [normalizedEmail, purpose]
  );

  const otpRow = rows[0];
  if (!otpRow) {
    return { ok: false, error: 'No active verification code found. Please request a new one.', status: 400 };
  }

  if (now > Number(otpRow.expires_at)) {
    await pool.exec('UPDATE email_otps SET consumed_at = ? WHERE id = ?', [now, otpRow.id]);
    return { ok: false, error: 'Verification code has expired. Please request a new one.', status: 400 };
  }

  if (Number(otpRow.attempts) >= OTP_MAX_ATTEMPTS) {
    await pool.exec('UPDATE email_otps SET consumed_at = ? WHERE id = ?', [now, otpRow.id]);
    return { ok: false, error: 'Too many incorrect attempts. Please request a new code.', status: 429 };
  }

  const candidateHash = hashOtpCode(normalizedEmail, purpose, cleanCode);
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(otpRow.code_hash, 'hex');
  const matches = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!matches) {
    await pool.exec('UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?', [otpRow.id]);
    return { ok: false, error: 'Invalid verification code.', status: 401 };
  }

  await pool.exec('UPDATE email_otps SET consumed_at = ? WHERE id = ?', [now, otpRow.id]);
  return { ok: true };
};
