// shared contracts for the future full-server backend
// account + plan + usage move here when the app leaves the Vercel free tier
// plain fields only, no classes, no runtime, so each module can pick its
// own engine and adapter
// mirrors the local-first dual window from src/lib/security/usage.ts,
// a 5-hour burst cap and a 7-day weekly cap at the same plan limit,
// so a cutover migrates data without changing its meaning

export type BackendPlanId = 'free' | 'supporters' | 'cool' | 'owner';

// valid_until is null for recurring grants, set for boxes
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
  created_at: string;
  updated_at: string;
}

export interface BackendAuthSession {
  account_id: string;
  issued_at: number;
  expires_at: number;
  // opaque ref, a server session cookie, not the local dc_session shape
  session_ref: string;
}

// window is the 5h burst cap, h5, or the 7d weekly cap, d7
// limit_tokens applies to each window independently
export interface BackendUsageWindow {
  window: 'h5' | 'd7';
  limit_tokens: number;
  used_tokens: number;
  start: number;
  end: number;
}

export interface BackendUsageLedger {
  // account id, not IP
  identity: string;
  plan: BackendPlanId;
  windows: BackendUsageWindow[];
  updated_at: string;
}
