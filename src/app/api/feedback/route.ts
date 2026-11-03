import { NextResponse } from 'next/server';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { ensureDataDirectoriesSync, DATA_DIR } from '@/lib/data-directories';

export const runtime = 'nodejs';

// Local-first feedback store. One record per (chat, message, rating): votes
// can be flipped, annotated with reasons/details (latest annotation wins),
// and inspected via GET. The file sits in the app DATA_DIR next to the rest
// of the server-side data, so it shares the same serverless/tmpdir behavior.
const DB_PATH = (() => {
  ensureDataDirectoriesSync();
  return path.join(DATA_DIR, 'deepchat-feedback.sqlite');
})();

const MAX_REASON_COUNT = 8;

const DISLIKE_REASONS: Record<string, true> = {
  'Always Error Response': true,
  'Visual is unhelpful or broken': true,
  'Incorrect or incomplete': true,
  'Not what I asked for': true,
  'Slow or buggy': true,
  'Style or tone': true,
  'Safety or legal concern': true,
  'Other': true
};

const LIKE_REASONS: Record<string, true> = {
  'Correct and helpful': true,
  'Clear explanation': true,
  'Well matched to the request': true,
  'Good formatting': true,
  'Other': true
};

let db: DatabaseSync | null = null;

const getDb = (): DatabaseSync | null => {
  try {
    if (!db) {
      db = new DatabaseSync(DB_PATH);
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec(`CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        rating TEXT NOT NULL,
        reasons_json TEXT,
        details_json TEXT,
        submit_ts TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (chat_id, message_id, rating)
      );`);
    }
    return db;
  } catch {
    // No writable storage (serverless, locked file). The client keeps the vote
    // in localStorage; we report the gap instead of pretending it persisted.
    return null;
  }
};

const normalizeString = (value: unknown, maxLen: number): string => {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLen).trim();
};

const parseReasons = (value: unknown, allowed: Record<string, true>): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && allowed[item] && !seen.has(item)) {
      seen.add(item);
      out.push(item);
      if (out.length >= MAX_REASON_COUNT) break;
    }
  }
  return out;
};

const storeUnavailable = () => NextResponse.json({ ok: false, error: 'feedback store unavailable', retryable: true });

export async function GET() {
  const database = getDb();
  if (!database) return storeUnavailable();
  const rows = database.prepare('SELECT id, chat_id, message_id, rating, reasons_json, details_json, submit_ts, created_at, updated_at FROM feedback ORDER BY id DESC LIMIT 200').all() as Record<string, unknown>[];
  return NextResponse.json({
    ok: true,
    feedback: rows.map(row => ({
      id: row.id as number,
      chatId: row.chat_id as string,
      messageId: row.message_id as string,
      rating: row.rating as string,
      reasons: typeof row.reasons_json === 'string' ? JSON.parse(row.reasons_json) : [],
      details: typeof row.details_json === 'string' ? JSON.parse(row.details_json) : '',
      submitTs: row.submit_ts as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string
    }))
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const chatId = normalizeString(body.chatId, 100);
    const messageId = normalizeString(body.messageId, 100);
    const rating = normalizeString(body.rating, 16);
    const remove = body.remove === true;

    if (!chatId || !messageId || (!remove && (rating !== 'like' && rating !== 'dislike'))) {
      return NextResponse.json({ ok: false, error: 'chatId, messageId and rating ("like" or "dislike") are required' });
    }

    const database = getDb();
    if (!database) return storeUnavailable();

    const now = new Date().toISOString();
    if (remove) {
      // Removing a vote clears both sides so the message is neutral again.
      database.prepare('DELETE FROM feedback WHERE chat_id = ? AND message_id = ?').run(chatId, messageId);
      return NextResponse.json({ ok: true, persisted: true, removed: true, savedAt: now });
    }

    const reasons = parseReasons(body.reasons, rating === 'like' ? LIKE_REASONS : DISLIKE_REASONS);
    const details = normalizeString(body.details, 2000);
    if (rating === 'like') {
      // Liking flips a previous dislike: the dislike row (with its reasons) is retired.
      database.prepare('DELETE FROM feedback WHERE chat_id = ? AND message_id = ? AND rating = \'dislike\'').run(chatId, messageId);
    }
    database.prepare(`
      INSERT INTO feedback (chat_id, message_id, rating, reasons_json, details_json, submit_ts, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (chat_id, message_id, rating) DO UPDATE SET
        reasons_json = COALESCE(excluded.reasons_json, feedback.reasons_json),
        details_json = COALESCE(excluded.details_json, feedback.details_json),
        submit_ts = excluded.submit_ts,
        updated_at = excluded.updated_at
    `).run(
      chatId,
      messageId,
      rating,
      reasons.length > 0 ? JSON.stringify(reasons) : null,
      details.length > 0 ? JSON.stringify(details) : null,
      now,
      now,
      now
    );

    // A dislike vote after an existing like removes the like, so a message carries one direction.
    if (rating === 'dislike') {
      database.prepare('DELETE FROM feedback WHERE chat_id = ? AND message_id = ? AND rating = \'like\'').run(chatId, messageId);
    }

    return NextResponse.json({ ok: true, persisted: true, savedAt: now });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ ok: false, error: 'invalid JSON body' });
    }
    console.error('[api/feedback] store error', error);
    return NextResponse.json({ ok: false, error: 'failed to store feedback', retryable: true });
  }
}
