// Planned public routes for the future server.
// The local-first /api/usage and /api/chat surface stays as-is.
// /api/account and /api/admin mount as child routers on the server.

import type { Account, BackendAuthSession, BackendUsageLedger } from '../types';

// Interface shape only, framework gets picked at cutover
export interface BackendRouter {
  get(path: string, handler: (ctx: BackendContext) => Promise<unknown>): void;
  post(path: string, handler: (ctx: BackendContext) => Promise<unknown>): void;
  put(path: string, handler: (ctx: BackendContext) => Promise<unknown>): void;
  delete(path: string, handler: (ctx: BackendContext) => Promise<unknown>): void;
}

export interface BackendContext {
  // Resolved by auth or admin middleware, blocks unauthenticated randos on admin routes
  principal: {
    account_id: string;
    kind: 'account' | 'admin';
    display_name?: string;
  };
  body: unknown;
  query: Record<string, string>;
  params: Record<string, string>;
  headers: Record<string, string>;
}

// Same invariants as GET and POST /api/usage today, just re-keyed on account_id
export type AccountRoutes = {
  'GET  /api/account': () => Promise<Account>;
  'POST /api/account': () => Promise<Account>;
  'GET  /api/account/usage': () => Promise<BackendUsageLedger>;
  'GET  /api/account/plans': () => Promise<unknown[]>;
  'POST /api/account/plans': () => Promise<BackendAuthSession>;
  'POST /api/account/auth': () => Promise<BackendAuthSession>;
} & {
  // Admin only, wired to AdminService.grant
  'POST /api/admin/grant': () => Promise<unknown>;
  'GET  /api/admin/audit': () => Promise<unknown[]>;
};

// Cutover note: existing usage handlers turn into read-only proxies that
// resolve the dc_session cookie to a BackendAuthSession and forward to
// /api/account/usage, then the old write path dies
