// future account + session service
// owns account creation, BackendAuthSession minting replacing the local
// dc_session shape, and importing an IP-keyed local grant into the
// new account so early users keep their tier
// everything that today decides who is this, the rate limiter and the
// usage ledger keyed on getClientIp, will key on an account_id instead

import type { Account, BackendAuthSession, BackendPlanId } from '../types';

export interface AuthPrincipal {
  account_id: string;
  email: string;
  plan: BackendPlanId;
  display_name: string;
}

export interface AuthSessionBackend {
  // creates or fetches a session, concrete impl decides cookie and rotation
  issueSession(account: Account): Promise<BackendAuthSession>;

  // returns null on missing, expired, or unknown ref, caller 401s
  resolveSession(sessionRef: string): Promise<AuthPrincipal | null>;

  // rotates session_ref, e.g. after a password change
  rotateSession(sessionRef: string): Promise<BackendAuthSession>;

  // revokes by account_id, used on degradation and account suspension
  revokeSessions(accountId: string): Promise<void>;
}

// shape only, verifier and transport are picked by the concrete module
export interface AccountRegistrationInput {
  email: string;
  // required for the password flow
  password?: string;
  // defaults to the email local-part
  display_name?: string;
}

export interface AccountService {
  register(input: AccountRegistrationInput): Promise<Account>;

  // plan change keeps local invariants, it changes the per-window cap and
  // does not reset current 5h/7d usage
  setPlan(accountId: string, grant: { plan: BackendPlanId; granted_by: 'self' | 'admin' | 'payment' }): Promise<Account>;
  lookup(accountId: string): Promise<Account | null>;
}
