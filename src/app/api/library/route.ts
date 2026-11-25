import { NextResponse } from 'next/server';
import { ensureTursoSchema } from '@/backend/db/connection';
import {
  createLibraryFolder,
  deleteLibraryFolder,
  emptyLibraryTrash,
  listLibraryData,
  moveItemsToFolder,
  permanentlyDeleteLibraryItems,
  renameLibraryFolder,
  restoreLibraryItems,
  setItemsFavorite,
  trashLibraryItems
} from '@/backend/library/service';
import { getVerifiedAccount } from '@/lib/security/auth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    return NextResponse.json({ authenticated: false, guest: true });
  }

  try {
    const pool = await ensureTursoSchema();
    if (!pool) {
      return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
    }

    const data = await listLibraryData(pool, verified.sub);
    return NextResponse.json({
      ok: true,
      authenticated: true,
      ...data
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load library.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const verified = getVerifiedAccount(req.headers);
  if (!verified) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  try {
    const pool = await ensureTursoSchema();
    if (!pool) {
      return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
    }

    const body = (await req.json()) as {
      action?: string;
      name?: string;
      folderId?: string | null;
      itemIds?: string[];
      isFavorite?: boolean;
    };

    const action = String(body.action || '');
    const itemIds = Array.isArray(body.itemIds)
      ? body.itemIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];

    switch (action) {
      case 'createFolder': {
        const folder = await createLibraryFolder(pool, verified.sub, String(body.name || ''));
        return NextResponse.json({ ok: true, folder });
      }
      case 'renameFolder': {
        if (!body.folderId) {
          return NextResponse.json({ error: 'Folder ID is required.' }, { status: 400 });
        }
        await renameLibraryFolder(pool, verified.sub, body.folderId, String(body.name || ''));
        return NextResponse.json({ ok: true });
      }
      case 'deleteFolder': {
        if (!body.folderId) {
          return NextResponse.json({ error: 'Folder ID is required.' }, { status: 400 });
        }
        await deleteLibraryFolder(pool, verified.sub, body.folderId);
        return NextResponse.json({ ok: true });
      }
      case 'favorite': {
        await setItemsFavorite(pool, verified.sub, itemIds, Boolean(body.isFavorite));
        return NextResponse.json({ ok: true });
      }
      case 'move': {
        await moveItemsToFolder(pool, verified.sub, itemIds, body.folderId ?? null);
        return NextResponse.json({ ok: true });
      }
      case 'trash': {
        await trashLibraryItems(pool, verified.sub, itemIds);
        return NextResponse.json({ ok: true });
      }
      case 'restore': {
        await restoreLibraryItems(pool, verified.sub, itemIds);
        return NextResponse.json({ ok: true });
      }
      case 'deletePermanent': {
        await permanentlyDeleteLibraryItems(pool, verified.sub, itemIds);
        return NextResponse.json({ ok: true });
      }
      case 'emptyTrash': {
        await emptyLibraryTrash(pool, verified.sub);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: 'Unsupported library action.' }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Library action failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
