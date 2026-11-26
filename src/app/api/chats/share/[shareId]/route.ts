import { NextResponse } from 'next/server';
import { ensureTursoSchema } from '@/backend/db/connection';
import { getSharedAccountChat } from '@/backend/chats/service';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  context: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await context.params;
    const pool = await ensureTursoSchema();
    if (!pool) {
      return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
    }
    const chat = await getSharedAccountChat(pool, decodeURIComponent(shareId));
    if (!chat) {
      return NextResponse.json({ error: 'Shared chat not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, chat });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load shared chat.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
