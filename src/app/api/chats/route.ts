import { NextResponse } from 'next/server';
import { requireDbPool } from '@/backend/auth/turso-auth';
import {
  createAccountChat,
  deleteAllAccountChats,
  listAccountChats,
  listAccountSharedLinks,
} from '@/backend/chats/service';
import { getVerifiedAccount } from '@/lib/security/auth';
import type { StoredAttachment } from '@/lib/storage/types';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const pool = await requireDbPool();
    const { searchParams } = new URL(req.url);
    if (searchParams.get('shared') === '1') {
      const links = await listAccountSharedLinks(pool, verified.sub);
      return NextResponse.json({ ok: true, links });
    }

    const archived = searchParams.get('archived') === '1';
    const chats = await listAccountChats(pool, verified.sub, archived);
    return NextResponse.json({ ok: true, chats });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load chats.';
    const status = message.includes('Database is not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      title?: string;
      attachedFiles?: StoredAttachment[];
    };
    const pool = await requireDbPool();
    const chat = await createAccountChat(pool, verified.sub, {
      id: typeof body.id === 'string' ? body.id : undefined,
      title: typeof body.title === 'string' ? body.title : 'New Chat',
      attachedFiles: Array.isArray(body.attachedFiles) ? body.attachedFiles : undefined,
    });
    return NextResponse.json({ ok: true, chat }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create chat.';
    const status = message.includes('Database is not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const pool = await requireDbPool();
    await deleteAllAccountChats(pool, verified.sub);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete chats.';
    const status = message.includes('Database is not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
