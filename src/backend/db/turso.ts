import path from 'path';
import type { DbPool } from './connection';
import { TURSO_SCHEMA_STATEMENTS } from './schema';
import { DATA_DIR, ensureDataDirectoriesSync, isServerless } from '@/lib/data-directories';

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
    // HTTP pipeline is stateless per request
  }
}

class LocalSqlitePool implements DbPool {
  private db: import('node:sqlite').DatabaseSync | null = null;

  private async getDb(): Promise<import('node:sqlite').DatabaseSync> {
    if (this.db) return this.db;
    const { DatabaseSync } = await import('node:sqlite');
    ensureDataDirectoriesSync();
    const dbPath = path.join(/* turbopackIgnore: true */ DATA_DIR, 'deepchat.sqlite');
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

  // On serverless without Turso env vars, local SQLite is ephemeral
  if (isServerless) {
    return null;
  }

  cachedPool = new LocalSqlitePool();
  return cachedPool;
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
    })().catch(err => {
      schemaReadyPromise = null;
      throw err;
    });
  }

  await schemaReadyPromise;
  return pool;
};
