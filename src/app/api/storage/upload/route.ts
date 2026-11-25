import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { ensureTursoSchema } from '@/backend/db/connection';
import {
  checkAccountStorageQuota,
  registerLibraryItem
} from '@/backend/library/service';
import { uploadToR2 } from '@/backend/storage/r2';
import { getVerifiedAccount } from '@/lib/security/auth';
import { hashIp } from '@/lib/security/crypto';
import { checkGuestUploadLimit } from '@/lib/security/guest-rate-limit';
import { MAX_ATTACHMENT_BYTES } from '@/lib/security/limits';
import { getClientIp } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

const ALLOWED_FOLDERS = new Set([
  'attachments',
  'library',
  'avatars',
  'profile',
  'images_generated'
]);

const sanitizeFilename = (name: string): string => {
  const cleaned = name
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return cleaned || 'file';
};

const resolveExtension = (file: File): string => {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/webp') return 'webp';
  if (type === 'image/png') return 'png';
  if (type === 'image/jpeg' || type === 'image/jpg') return 'jpg';
  if (type === 'image/gif') return 'gif';
  const extMatch = file.name.match(/\.([a-zA-Z0-9]{2,6})$/);
  return extMatch ? extMatch[1].toLowerCase() : 'webp';
};

export async function POST(req: Request) {
  const account = getVerifiedAccount(req.headers);
  const isGuest = account === null;
  const clientIp = getClientIp(req).slice(0, 128);

  try {
    const form = await req.formData();
    const file = form.get('file');
    const rawFolder =
      typeof form.get('folder') === 'string' ? String(form.get('folder')).trim() : 'attachments';
    const folder = ALLOWED_FOLDERS.has(rawFolder) ? rawFolder : 'attachments';
    const folderId =
      typeof form.get('folderId') === 'string' && form.get('folderId')
        ? String(form.get('folderId')).trim()
        : null;

    if (isGuest) {
      if (folder !== 'attachments') {
        return NextResponse.json(
          {
            error: 'login_required',
            message: 'Sign in required to upload to library or profile.'
          },
          { status: 403 }
        );
      }

      const uploadVerdict = await checkGuestUploadLimit(clientIp);
      if (!uploadVerdict.allowed) {
        return NextResponse.json(
          {
            error: 'guest_upload_limit_exceeded',
            message: `Guest upload limit reached (max ${uploadVerdict.limit} uploads). Please sign in to upload more.`,
            retryAfterSeconds: uploadVerdict.retryAfterSeconds ?? 60
          },
          {
            status: 429,
            headers: {
              'retry-after': String(uploadVerdict.retryAfterSeconds ?? 60),
              'x-ratelimit-limit': String(uploadVerdict.limit),
              'x-ratelimit-remaining': '0'
            }
          }
        );
      }
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file in form data.' }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 });
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB.`
        },
        { status: 413 }
      );
    }

    const pool = account ? await ensureTursoSchema() : null;

    // Enforce 256 MB per-user storage quota for library/generated/profile uploads
    if (account && pool && folder !== 'attachments') {
      const quota = await checkAccountStorageQuota(pool, account.sub, file.size);
      if (!quota.allowed) {
        return NextResponse.json(
          {
            error: 'storage_quota_exceeded',
            message: 'Your 256 MB storage limit is full. Delete items or empty Trash to free space.',
            usedBytes: quota.usedBytes,
            limitBytes: quota.limitBytes
          },
          { status: 413 }
        );
      }
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = resolveExtension(file);
    const contentType = file.type || 'application/octet-stream';

    let key: string;
    if (account && (folder === 'profile' || folder === 'avatars')) {
      let handle = account.sub;
      if (pool) {
        const rows = await pool.query<{ username: string | null }>(
          'SELECT username FROM accounts WHERE id = ? LIMIT 1',
          [account.sub]
        );
        if (rows[0]?.username) {
          handle = rows[0].username;
        }
      }
      const safeHandle = sanitizeFilename(handle);
      key = `u/profile/${safeHandle}.${ext}`;
    } else if (account && folder === 'images_generated') {
      const rand = crypto.randomBytes(5).toString('hex');
      key = `images_generated/dc${rand}.${ext}`;
    } else if (account && folder === 'library') {
      key = `images/${account.sub}/${crypto.randomUUID()}.${ext}`;
    } else {
      const safeName = sanitizeFilename(file.name);
      const ownerPrefix = account ? `users/${account.sub}` : `guests/${hashIp(clientIp)}`;
      key = `${ownerPrefix}/${folder}/${crypto.randomUUID()}-${safeName}`;
    }

    const uploaded = await uploadToR2({
      key,
      body: bytes,
      contentType
    });

    let libraryItem = null;
    if (account && pool && (folder === 'library' || folder === 'images_generated')) {
      libraryItem = await registerLibraryItem(pool, {
        accountId: account.sub,
        folderId,
        r2Key: uploaded.key,
        url: uploaded.url,
        fileName: file.name || `${key.split('/').pop()}`,
        mimeType: contentType,
        sizeBytes: file.size,
        source: folder === 'images_generated' ? 'generated' : 'upload',
        metadata: {
          uploadedAt: new Date().toISOString()
        }
      });
    }

    return NextResponse.json({
      ok: true,
      key: uploaded.key,
      url: uploaded.url,
      fileName: file.name,
      sizeBytes: file.size,
      contentType,
      item: libraryItem
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.';
    const status = message.includes('not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
