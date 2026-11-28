import { NextResponse } from 'next/server';
import { requireDbPool } from '@/backend/db/account-session';
import {
  deleteAccountWorkspace,
  getAccountWorkspace,
  saveAccountWorkspace,
  uploadWorkspaceBinary,
  type SaveWorkspaceFileInput,
} from '@/backend/canvas/service';
import { getVerifiedAccount } from '@/lib/security/auth';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  context: { params: Promise<{ chatId: string }> }
) {
  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const { chatId } = await context.params;
    const pool = await requireDbPool();
    const workspace = await getAccountWorkspace(pool, verified.sub, decodeURIComponent(chatId));
    if (!workspace) {
      return NextResponse.json({ error: 'Chat not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load workspace.';
    const status = message.includes('Database is not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ chatId: string }> }
) {
  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const { chatId } = await context.params;
    const body = (await req.json()) as {
      title?: string;
      activeFilePath?: string | null;
      files?: SaveWorkspaceFileInput[];
    };
    const pool = await requireDbPool();
    const workspace = await saveAccountWorkspace(pool, verified.sub, decodeURIComponent(chatId), {
      title: body.title,
      activeFilePath: body.activeFilePath,
      files: Array.isArray(body.files) ? body.files : [],
    });
    if (!workspace) {
      return NextResponse.json({ error: 'Chat not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, workspace });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save workspace.';
    const status = message.includes('Database is not configured')
      ? 503
      : message.includes('Invalid') || message.includes('exceeds') || message.includes('limited')
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ chatId: string }> }
) {
  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const { chatId } = await context.params;
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file upload.' }, { status: 400 });
    }

    const pool = await requireDbPool();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const uploaded = await uploadWorkspaceBinary(
      pool,
      verified.sub,
      decodeURIComponent(chatId),
      file.name,
      file.type || 'application/octet-stream',
      bytes
    );

    if (!uploaded) {
      return NextResponse.json({ error: 'Chat not found.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...uploaded });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload workspace file.';
    const status =
      message.includes('not configured')
        ? 503
        : message.includes('exceeds')
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ chatId: string }> }
) {
  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const { chatId } = await context.params;
    const pool = await requireDbPool();
    await deleteAccountWorkspace(pool, verified.sub, decodeURIComponent(chatId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete workspace.';
    const status = message.includes('Database is not configured') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
