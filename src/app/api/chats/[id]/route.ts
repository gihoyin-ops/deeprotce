import { NextResponse } from 'next/server';
import { requireDbPool } from '@/backend/db/account-session';
import {
  deleteAccountChat,
  getAccountChat,
  saveAccountMessage,
  updateAccountChat,
} from '@/backend/chats/service';
import { getVerifiedAccount } from '@/lib/security/auth';
import type { StoredChat, StoredMessage } from '@/lib/storage/types';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const pool = await requireDbPool();
    const chat = await getAccountChat(pool, verified.sub, decodeURIComponent(id));
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, chat });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load chat.';
    const status = message.includes('Database is not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const chatId = decodeURIComponent(id);
    const body = (await req.json()) as {
      message?: StoredMessage;
      updates?: Partial<StoredChat>;
    };
    const pool = await requireDbPool();

    if (body.message) {
      await saveAccountMessage(pool, verified.sub, chatId, body.message);
      const chat = await getAccountChat(pool, verified.sub, chatId);
      return NextResponse.json({ ok: true, chat });
    }

    const updates = body.updates ?? (body as Partial<StoredChat>);
    const chat = await updateAccountChat(pool, verified.sub, chatId, updates);
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, chat });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update chat.';
    const status = message.includes('Database is not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const pool = await requireDbPool();
    await deleteAccountChat(pool, verified.sub, decodeURIComponent(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete chat.';
    const status = message.includes('Database is not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
