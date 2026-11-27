import crypto from 'node:crypto';
import path from 'path';
import type { DbPool } from './connection';
import { TURSO_SCHEMA_STATEMENTS } from './schema';
import { DATA_DIR, ensureDataDirectoriesSync, isServerless } from '@/lib/data-directories';
import { buildDefaultAvatarUrl } from '@/lib/avatar';
import { hashPassword } from '@/lib/security/crypto';

type HranaArg =
  | { type: 'null' }
  | { type: 'integer'; value: string }
  | { type: 'float'; value: number }
  | { type: 'text'; value: string }
  | { type: 'blob'; base64: string };

type HranaValue = {
  type: 'null' | 'integer' | 'float' | 'text' | 'blob';
  value?: string | number;
  base64?: string;
};

type HranaResult = {
  type: 'ok' | 'error';
  response?: {
    type: 'execute' | 'close';
    result?: {
      cols: { name: string }[];
      rows: HranaValue[][];
      affected_row_count: number;
    };
  };
  error?: { message: string; code?: string };
};

const toHranaArg = (value: unknown): HranaArg => {
  if (value === null || value === undefined) return { type: 'null' };
  if (typeof value === 'boolean') return { type: 'integer', value: value ? '1' : '0' };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { type: 'integer', value: String(value) };
    return { type: 'float', value };
  }
  if (typeof value === 'string') return { type: 'text', value };
  if (value instanceof Uint8Array) {
    return { type: 'blob', base64: Buffer.from(value).toString('base64') };
  }
  return { type: 'text', value: JSON.stringify(value) };
};

const fromHranaValue = (cell: HranaValue): unknown => {
  if (cell.type === 'null') return null;
  if (cell.type === 'integer') return Number(cell.value);
  if (cell.type === 'float') return Number(cell.value);
  if (cell.type === 'text') return cell.value ?? '';
  if (cell.type === 'blob') return cell.base64 ?? '';
  return null;
};

const normalizeTursoHttpUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (trimmed.startsWith('libsql://')) {
    return `https://${trimmed.slice('libsql://'.length)}/v2/pipeline`;
  }
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed.endsWith('/v2/pipeline') ? trimmed : `${trimmed}/v2/pipeline`;
  }
  return `https://${trimmed}/v2/pipeline`;
};

class TursoHttpPool implements DbPool {
  private readonly pipelineUrl: string;
  private readonly authToken: string;

  constructor(databaseUrl: string, authToken: string) {
    this.pipelineUrl = normalizeTursoHttpUrl(databaseUrl);
    this.authToken = authToken;
  }

  private async runPipeline(
    statements: { sql: string; args?: unknown[] }[]
  ): Promise<HranaResult[]> {
    const requests = [
      ...statements.map(stmt => ({
        type: 'execute',
        stmt: {
          sql: stmt.sql,
          args: (stmt.args ?? []).map(toHranaArg)
        }
      })),
      { type: 'close' }
    ];

    const res = await fetch(this.pipelineUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.authToken}`
      },
      body: JSON.stringify({ requests }),
      cache: 'no-store'
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Turso HTTP error ${res.status}: ${text.slice(0, 200)}`);
    }

    const payload = (await res.json()) as { results?: HranaResult[] };
    const results = payload.results ?? [];
    for (const item of results) {
      if (item.type === 'error') {
        throw new Error(item.error?.message || 'Turso query failed');
      }
    }
    return results;
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [first] = await this.runPipeline([{ sql, args: params }]);
    const result = first?.response?.result;
    if (!result) return [];
    const cols = result.cols.map(c => c.name);
    return result.rows.map(row => {
      const record: Record<string, unknown> = {};
      for (let i = 0; i < cols.length; i += 1) {
        record[cols[i]] = fromHranaValue(row[i]);
      }
      return record as T;
    });
  }

  async exec(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
    const [first] = await this.runPipeline([{ sql, args: params }]);
    return { changes: first?.response?.result?.affected_row_count ?? 0 };
  }

  async batch(statements: string[]): Promise<void> {
    if (statements.length === 0) return;
    await this.runPipeline(statements.map(sql => ({ sql })));
  }

  async ping(): Promise<boolean> {
    try {
      await this.query('SELECT 1 AS ok');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    // HTTP pipeline is stateless per request, nothing to tear down here
  }
}

class LocalSqlitePool implements DbPool {
  private db: import('node:sqlite').DatabaseSync | null = null;

  private async getDb(): Promise<import('node:sqlite').DatabaseSync> {
    if (this.db) return this.db;
    const { DatabaseSync } = await import('node:sqlite');
    ensureDataDirectoriesSync();
    const dbPath = path.join(/*turbopackIgnore: true*/ DATA_DIR, 'deepchat.sqlite');
    const instance = new DatabaseSync(dbPath);
    instance.exec('PRAGMA journal_mode = WAL;');
    instance.exec('PRAGMA foreign_keys = ON;');
    this.db = instance;
    return instance;
  }

  async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = await this.getDb();
    const stmt = db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  async exec(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
    const db = await this.getDb();
    if (params.length === 0) {
      db.exec(sql);
      return { changes: 0 };
    }
    const result = db.prepare(sql).run(...params);
    return { changes: Number(result.changes ?? 0) };
  }

  async ping(): Promise<boolean> {
    try {
      await this.query('SELECT 1 AS ok');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

let cachedPool: DbPool | null = null;
let schemaReadyPromise: Promise<void> | null = null;

export const isTursoConfigured = (): boolean => {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const token = process.env.TURSO_AUTH_TOKEN?.trim();
  return Boolean(url && token);
};

export const getDbPool = (): DbPool | null => {
  if (cachedPool) return cachedPool;

  const url = process.env.TURSO_DATABASE_URL?.trim();
  const token = process.env.TURSO_AUTH_TOKEN?.trim();

  if (url && token) {
    cachedPool = new TursoHttpPool(url, token);
    return cachedPool;
  }

  // On serverless without Turso env vars, local SQLite is ephemeral garbage so bail out
  if (isServerless) {
    return null;
  }

  cachedPool = new LocalSqlitePool();
  return cachedPool;
};

const ensureAccountSecurityColumns = async (pool: DbPool): Promise<void> => {
  const migrations = [
    `ALTER TABLE accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`,
    `ALTER TABLE accounts ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE accounts ADD COLUMN ban_reason TEXT`,
    `ALTER TABLE accounts ADD COLUMN banned_at TEXT`,
    `ALTER TABLE accounts ADD COLUMN banned_by TEXT`,
    `ALTER TABLE chats ADD COLUMN pending_attached_files_json TEXT`
  ];
  for (const sql of migrations) {
    try {
      await pool.exec(sql);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/duplicate column|already exists/i.test(msg)) {
        throw err;
      }
    }
  }
};

const ensureStaffAccountsAndPlans = async (pool: DbPool): Promise<void> => {
  await ensureAccountSecurityColumns(pool);

  // Migrate old plan='owner' / plan='staff' shit into role='staff'
  await pool.exec(
    `UPDATE accounts SET role = 'staff' WHERE LOWER(plan) IN ('owner', 'staff') AND (role IS NULL OR LOWER(role) = 'user')`
  );
  await pool.exec(
    `UPDATE accounts SET plan = 'cool' WHERE LOWER(plan) IN ('owner', 'staff')`
  );
  await pool.exec(`UPDATE plan_grants SET plan = 'cool' WHERE LOWER(plan) IN ('owner', 'staff')`);

  const staffEmail = 'revaldo@deepsia.my.id';
  const existing = await pool.query<{ id: string; plan: string; role: string }>(
    'SELECT id, plan, role FROM accounts WHERE LOWER(email) = ? LIMIT 1',
    [staffEmail]
  );

  const nowIso = new Date().toISOString();
  if (existing.length === 0) {
    const accountId = crypto.randomUUID();
    const passwordHash = await hashPassword('Faldoraja2026');
    const avatarUrl = buildDefaultAvatarUrl(accountId);
    await pool.exec(
      `INSERT OR IGNORE INTO accounts (id, email, username, password_hash, display_name, avatar_url, plan, role, is_banned, email_verified, created_at, updated_at)
       VALUES (?, ?, 'revaldo', ?, 'Revaldo', ?, 'cool', 'manager_staff', 0, 1, ?, ?)`,
      [accountId, staffEmail, passwordHash, avatarUrl, nowIso, nowIso]
    );
    await pool.exec(
      `INSERT OR IGNORE INTO plan_grants (id, account_id, plan, granted_by, valid_from, valid_until)
       VALUES (?, ?, 'cool', 'admin', ?, NULL)`,
      [crypto.randomUUID(), accountId, nowIso]
    );
  } else if (existing[0].role?.toLowerCase() !== 'manager_staff') {
    await pool.exec('UPDATE accounts SET role = ?, updated_at = ? WHERE id = ?', [
      'manager_staff',
      nowIso,
      existing[0].id
    ]);
  }
};

export const ensureTursoSchema = async (): Promise<DbPool | null> => {
  const pool = getDbPool();
  if (!pool) return null;

  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      if (pool instanceof TursoHttpPool) {
        await pool.batch(TURSO_SCHEMA_STATEMENTS);
      } else {
        for (const stmt of TURSO_SCHEMA_STATEMENTS) {
          await pool.exec(stmt);
        }
      }
      await ensureStaffAccountsAndPlans(pool);
    })().catch(err => {
      schemaReadyPromise = null;
      throw err;
    });
  }

  await schemaReadyPromise;
  return pool;
};
