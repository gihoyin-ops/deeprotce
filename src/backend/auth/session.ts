// Future account and session service.
// Owns account creation, minting BackendAuthSession to replace the local
// dc_session shape, and importing an IP-keyed local grant into the new
// account so early users don't lose their tier.
// Everything that currently decides who the user is (rate limiter and usage
// ledger keyed on getClientIp) will key on account_id instead.

import type { Account, BackendAuthSession, BackendPlanId } from '../types';

export interface AuthPrincipal {
  account_id: string;
  email: string;
  plan: BackendPlanId;
  display_name: string;
}

export interface AuthSessionBackend {
  // Creates or fetches a session, concrete impl handles cookies and rotation
  issueSession(account: Account): Promise<BackendAuthSession>;

  // Returns null if missing, expired, or bogus ref, caller throws 401
  resolveSession(sessionRef: string): Promise<AuthPrincipal | null>;

  // Rotates session_ref, like after a password reset
  rotateSession(sessionRef: string): Promise<BackendAuthSession>;

  // Nukes sessions by account_id when degrading or suspending an account
  revokeSessions(accountId: string): Promise<void>;
}

// Contract shape only, concrete module picks the verifier and transport
export interface AccountRegistrationInput {
  email: string;
  // Needed for password auth flow
  password?: string;
  // Falls back to the email local-part if omitted
  display_name?: string;
}

export interface AccountService {
  register(input: AccountRegistrationInput): Promise<Account>;

  // Plan change keeps local invariants, swaps the per-window cap without
  // wiping current 5h/7d usage
  setPlan(accountId: string, grant: { plan: BackendPlanId; granted_by: 'self' | 'admin' | 'payment' }): Promise<Account>;
  lookup(accountId: string): Promise<Account | null>;
}
