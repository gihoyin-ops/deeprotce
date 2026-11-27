import { NextResponse } from 'next/server';
import { getFromR2 } from '@/backend/storage/r2';
import { MAX_ATTACHMENT_BYTES } from '@/lib/security/limits';
import { assertEgressUrl } from '@/lib/security/url-guard';

export const runtime = 'nodejs';

const ALLOWED_KEY_PREFIXES = [
  'attachments/',
  'library/',
  'avatars/',
  'profile/',
  'images_generated/'
];

const isSafeStorageKey = (key: string): boolean => {
  if (!key || key.includes('..') || key.includes('\\') || key.startsWith('/')) {
    return false;
  }
  return ALLOWED_KEY_PREFIXES.some(prefix => key.startsWith(prefix));
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key')?.trim() || '';
  const imageUrl = searchParams.get('imageUrl')?.trim() || '';

  if (key) {
    if (!isSafeStorageKey(key)) {
      return NextResponse.json({ error: 'Invalid storage key.' }, { status: 400 });
    }
    try {
      const obj = await getFromR2(key);
      if (!obj) {
        return NextResponse.json({ error: 'File not found.' }, { status: 404 });
      }
      return new NextResponse(Buffer.from(obj.body), {
        status: 200,
        headers: {
          'content-type': obj.contentType,
          'cache-control': 'private, max-age=3600',
          'x-content-type-options': 'nosniff'
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch R2 file.';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (imageUrl) {
    try {
      const safeUrl = await assertEgressUrl(imageUrl);
      const upstream = await fetch(safeUrl, {
        signal: AbortSignal.timeout(12000),
        headers: {
          accept: 'image/*,*/*;q=0.8'
        }
      });
      if (!upstream.ok) {
        return NextResponse.json({ error: 'Upstream image fetch failed.' }, { status: 502 });
      }
      const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
      if (!contentType.startsWith('image/')) {
        return NextResponse.json({ error: 'URL did not return an image.' }, { status: 415 });
      }
      const buf = new Uint8Array(await upstream.arrayBuffer());
      if (buf.byteLength === 0 || buf.byteLength > MAX_ATTACHMENT_BYTES) {
        return NextResponse.json({ error: 'Image is empty or exceeds size limit.' }, { status: 413 });
      }
      return new NextResponse(Buffer.from(buf), {
        status: 200,
        headers: {
          'content-type': contentType,
          'cache-control': 'private, max-age=300',
          'x-content-type-options': 'nosniff'
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch image URL.';
      const status = message === 'unsafe_egress_url' ? 400 : 502;
      return NextResponse.json({ error: message }, { status });
    }
  }

  return NextResponse.json({ error: 'Missing key or imageUrl parameter.' }, { status: 400 });
}
