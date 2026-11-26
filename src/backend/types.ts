// Shared contracts for the future full-server backend.
// Account, plan, and usage move here once the app ditches the Vercel free tier.
// Plain fields only, no classes or runtime code, so each module can pick
// its own engine and adapter.
// Mirrors the local-first dual window from src/lib/security/usage.ts
// (a 5-hour burst cap and a 7-day weekly cap at the same plan limit)
// so cutover migrates data without changing what it means.

export type BackendPlanId = 'free' | 'supporters' | 'cool' | 'staff';

export type AccountRole = 'user' | 'staff' | 'manager_staff';

// valid_until is null for recurring grants, set for one-off boxes
export interface BackendPlanGrant {
  account_id: string;
  plan: BackendPlanId;
  granted_by: 'self' | 'admin' | 'payment';
  valid_from: string;
  valid_until: string | null;
}

export interface Account {
  id: string;
  email: string;
  display_name: string;
  plan: BackendPlanId;
  role?: AccountRole;
  created_at: string;
  updated_at: string;
}

export interface BackendAuthSession {
  account_id: string;
  issued_at: number;
  expires_at: number;
  // Opaque server session cookie ref, not the local dc_session shape
  session_ref: string;
}

// window is either the 5h burst cap (h5) or the 7d weekly cap (d7).
// limit_tokens applies independently to each window.
export interface BackendUsageWindow {
  window: 'h5' | 'd7';
  limit_tokens: number;
  used_tokens: number;
  start: number;
  end: number;
}

export interface BackendUsageLedger {
  // Account id, not IP
  identity: string;
  plan: BackendPlanId;
  windows: BackendUsageWindow[];
  updated_at: string;
}
