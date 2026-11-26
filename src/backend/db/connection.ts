// Engine-neutral pool contract for the future server.
// Mirrors the local per-process DatabaseSync, actual implementation lands on
// Postgres/Neon, kept driver-agnostic on purpose so the rest of the codebase
// only depends on this interface.

import type { BackendPlanGrant, BackendUsageLedger, BackendUsageWindow } from '../types';

export interface DbPool {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export { ensureTursoSchema, getDbPool, isTursoConfigured } from './turso';

// Thin read shapes for the account, plan, and usage services
export type PlanGrantQuery = {
  accountId: string;
} & Pick<BackendPlanGrant, 'plan'>;

export type UsageWindowQuery = Pick<BackendUsageWindow, 'window' | 'limit_tokens' | 'used_tokens' | 'start' | 'end'>;

export type UsageLedgerQuery = BackendUsageLedger;
