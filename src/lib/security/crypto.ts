import crypto from 'node:crypto';
import type { AccountRole, BackendPlanId } from '@/backend/types';

export interface SignedAccountClaims {
  sub: string; // account_id, don't mix this up
  sid: string; // auth_sessions.id, session row key
  email: string;
  plan: BackendPlanId;
  role?: AccountRole;
  name: string;
  exp: number; // unix ms, not seconds dumbass
}

const DEV_FALLBACK_SECRET = 'deepchat-local-dev-session-secret-change-in-prod';

const getSessionSecret = (): string | null => {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 16) return configured;
  if (process.env.NODE_ENV === 'production') return null;
  return DEV_FALLBACK_SECRET;
};

const getEncryptionKey = (): Buffer => {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (raw) {
    // Take a 64-char hex key or hash whatever passphrase they gave into 32 bytes
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      return Buffer.from(raw, 'hex');
    }
    return crypto.createHash('sha256').update(raw).digest();
  }
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('ENCRYPTION_KEY or SESSION_SECRET must be set in production');
  }
  return crypto.createHash('sha256').update(`enc:${secret}`).digest();
};

export const hashToken = (rawToken: string): string =>
  crypto.createHash('sha256').update(rawToken).digest('hex');

export const hashIp = (ip: string): string => {
  const salt = getSessionSecret() ?? 'deepchat-ip-salt';
  return crypto.createHmac('sha256', salt).update(ip).digest('hex').slice(0, 32);
};

// Scrypt password hashing, spits out `scrypt$<saltHex>$<hashHex>`
export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.randomBytes(16);
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
};

export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, saltHex, hashHex] = parts;
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, expected.length, { N: 16384, r: 8, p: 1 }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });

  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
};

// AES-256-GCM encryption for sensitive DB columns like user API keys
// Spits out `v1$<ivBase64Url>$<tagBase64Url>$<cipherBase64Url>`
export const encryptSecret = (plaintext: string): string => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1$${iv.toString('base64url')}$${tag.toString('base64url')}$${encrypted.toString('base64url')}`;
};

export const decryptSecret = (ciphertext: string): string => {
  const parts = ciphertext.split('$');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Unsupported encrypted payload format');
  }
  const key = getEncryptionKey();
  const iv = Buffer.from(parts[1], 'base64url');
  const tag = Buffer.from(parts[2], 'base64url');
  const data = Buffer.from(parts[3], 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
};

// Signed account session cookie, `<payloadBase64Url>.<hmacBase64Url>`
export const signAccountClaims = (claims: SignedAccountClaims): string => {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('SESSION_SECRET must be set in production');
  }
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
};

export const verifyAccountClaims = (token: string | null | undefined): SignedAccountClaims | null => {
  if (!token) return null;
  const secret = getSessionSecret();
  if (!secret) return null;

  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (!payload || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest();
  let actualSig: Buffer;
  try {
    actualSig = Buffer.from(sig, 'base64url');
  } catch {
    return null;
  }
  if (actualSig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(actualSig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<SignedAccountClaims>;
    if (
      typeof parsed.sub !== 'string' ||
      typeof parsed.sid !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.exp !== 'number' ||
      Date.now() > parsed.exp
    ) {
      return null;
    }
    return {
      sub: parsed.sub,
      sid: parsed.sid,
      email: parsed.email,
      plan: (parsed.plan as BackendPlanId) ?? 'free',
      name: typeof parsed.name === 'string' ? parsed.name : parsed.email.split('@')[0] || 'User',
      exp: parsed.exp
    };
  } catch {
    return null;
  }
};
