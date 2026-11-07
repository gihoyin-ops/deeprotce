// planned public routes for the future server
// the local-first /api/usage and /api/chat surface stays unchanged
// /api/account and /api/admin mount as child routers on the server

import type { Account, BackendAuthSession, BackendUsageLedger } from '../types';

// shape only, framework is picked at cutover
export interface BackendRouter {
  get(path: string, handler: (ctx: BackendContext) => Promise<unknown>): void;
  post(path: string, handler: (ctx: BackendContext) => Promise<unknown>): void;
  put(path: string, handler: (ctx: BackendContext) => Promise<unknown>): void;
  delete(path: string, handler: (ctx: BackendContext) => Promise<unknown>): void;
}

export interface BackendContext {
  // resolved by auth or admin, blocks anonymous access on admin routes
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

// same invariants as GET and POST /api/usage today, re-keyed on account
export type AccountRoutes = {
  'GET  /api/account': () => Promise<Account>;
  'POST /api/account': () => Promise<Account>;
  'GET  /api/account/usage': () => Promise<BackendUsageLedger>;
  'GET  /api/account/plans': () => Promise<unknown[]>;
  'POST /api/account/plans': () => Promise<BackendAuthSession>;
  'POST /api/account/auth': () => Promise<BackendAuthSession>;
} & {
  // admin only, becomes AdminService.grant
  'POST /api/admin/grant': () => Promise<unknown>;
  'GET  /api/admin/audit': () => Promise<unknown[]>;
};

// cutover hint, existing usage handlers become read-only proxies that
// resolve the dc_session cookie to a BackendAuthSession and forward to
// /api/account/usage, the write path retires
