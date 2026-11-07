// future account-level usage service, re-keys the local-first ledger
// from identity, ip, to identity, account_id
// check gates a spend, record is the only writer, the service fails
// open when the store is unreachable, mirroring the local behaviour

import type {
  BackendPlanId,
  BackendUsageLedger,
  BackendUsageWindow,
} from '../types';

export interface UsageMeterBackend {
  // current dual-window state, mirrors getUsageSnapshot
  getLedger(accountId: string): Promise<BackendUsageLedger>;

  // null breaches mean the caller must fail open
  check(accountId: string): Promise<{
    allowed: boolean;
    reason?: 'usage_limit_reached';
    window?: 'h5' | 'd7';
    retry_after_ms?: number;
  }>;

  // one atomic add onto both windows, provider usage or estimate
  record(accountId: string, tokens: number): Promise<void>;

  identity: { kind: 'account' };

  // plan cap for the UI, plan default when no grant exists
  getPlan(accountId: string): Promise<BackendPlanId>;
}

// same fields as the local-first usage table, plan, h5, d7
export type WindowCap = Pick<BackendUsageWindow, 'limit_tokens' | 'used_tokens' | 'start' | 'end'>;
