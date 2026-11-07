// engine-neutral pool contract for the future server
// mirrors the local-first per-process DatabaseSync, implementation
// lands on Postgres/Neon, driver-agnostic on purpose so the rest of
// the tree depends only on this shape

import type { BackendPlanGrant, BackendUsageLedger, BackendUsageWindow } from '../types';

export interface DbPool {
  query<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<{ changes: number }>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

// thin read shapes for the account, plan, and usage service
export type PlanGrantQuery = {
  accountId: string;
} & Pick<BackendPlanGrant, 'plan'>;

export type UsageWindowQuery = Pick<BackendUsageWindow, 'window' | 'limit_tokens' | 'used_tokens' | 'start' | 'end'>;

export type UsageLedgerQuery = BackendUsageLedger;
