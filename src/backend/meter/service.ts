// Future account-level usage service, re-keys the local-first ledger
// from IP identity to account_id.
// check() gates a spend, record() is the only writer, and it fails open
// if the store shits the bed, matching the local behavior.

import type {
  BackendPlanId,
  BackendUsageLedger,
  BackendUsageWindow,
} from '../types';

export interface UsageMeterBackend {
  // Current dual-window state, mirrors getUsageSnapshot
  getLedger(accountId: string): Promise<BackendUsageLedger>;

  // Null breaches mean the caller has to fail open
  check(accountId: string): Promise<{
    allowed: boolean;
    reason?: 'usage_limit_reached';
    window?: 'h5' | 'd7';
    retry_after_ms?: number;
  }>;

  // Single atomic increment on both windows from provider usage or estimate
  record(accountId: string, tokens: number): Promise<void>;

  identity: { kind: 'account' };

  // Plan cap for the UI, falls back to plan default if no grant exists
  getPlan(accountId: string): Promise<BackendPlanId>;
}

// Same fields as the local-first usage table (plan, h5, d7)
export type WindowCap = Pick<BackendUsageWindow, 'limit_tokens' | 'used_tokens' | 'start' | 'end'>;
