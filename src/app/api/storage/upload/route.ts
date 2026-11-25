import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { uploadToR2 } from '@/backend/storage/r2';
import { getVerifiedAccount } from '@/lib/security/auth';
import { hashIp } from '@/lib/security/crypto';
import { checkGuestUploadLimit } from '@/lib/security/guest-rate-limit';
import { MAX_ATTACHMENT_BYTES } from '@/lib/security/limits';
import { getClientIp } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

const ALLOWED_FOLDERS = new Set(['attachments', 'library', 'avatars']);

const sanitizeFilename = (name: string): string => {
  const cleaned = name
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return cleaned || 'file';
};

export async function POST(req: Request) {
  const account = getVerifiedAccount(req.headers);
  const isGuest = account === null;
  const clientIp = getClientIp(req).slice(0, 128);

  try {
    const form = await req.formData();
    const file = form.get('file');
    const rawFolder = typeof form.get('folder') === 'string' ? String(form.get('folder')).trim() : 'attachments';
    const folder = ALLOWED_FOLDERS.has(rawFolder) ? rawFolder : 'attachments';

    // Guests can only upload temporary chat attachments, up to 10 total uploads
    if (isGuest) {
      if (folder !== 'attachments') {
        return NextResponse.json(
          { error: 'login_required', message: 'Sign in required to upload to library or avatars.' },
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
        { error: `File too large. Maximum size is ${Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB.` },
        { status: 413 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const safeName = sanitizeFilename(file.name);
    const ownerPrefix = account ? `users/${account.sub}` : `guests/${hashIp(clientIp)}`;
    const key = `${ownerPrefix}/${folder}/${crypto.randomUUID()}-${safeName}`;
    const contentType = file.type || 'application/octet-stream';

    const uploaded = await uploadToR2({
      key,
      body: bytes,
      contentType
    });

    return NextResponse.json({
      ok: true,
      key: uploaded.key,
      url: uploaded.url,
      fileName: file.name,
      sizeBytes: file.size,
      contentType
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed.';
    const status = message.includes('not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
