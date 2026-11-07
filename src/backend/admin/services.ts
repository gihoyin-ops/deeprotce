// future operator surface, replaces the DEEPCHAT_USAGE_ADMIN env flag
// until the cutover plan elevation is a single env flag, this module
// adds an authenticated operator and an audit trail

import type { BackendPlanGrant } from '../types';

export interface AdminIdentity {
  // regular account or operator
  id: string;
  kind: 'account' | 'admin';
  display_name: string;
}

export interface PlanGrantOperation {
  accountId: string;
  grant: BackendPlanGrant;
  // operator recorded in the audit log alongside the grant
  operator: AdminIdentity;
}

// every grant writes operator, timestamp, and the previous grant so a
// mistake can be rolled back
export interface AdminAuditEntry {
  ts: string;
  operator: AdminIdentity;
  account_id: string;
  // null when the account did not exist
  from_plan: string | null;
  to_plan: string;
  // required free text
  reason: string;
}

export interface AdminService {
  // requires an authenticated operator and a reason
  grant(
    operation: PlanGrantOperation
  ): Promise<BackendPlanGrant>;

  // reason must be at least 8 chars, a bare plan value is not a grant
  audit: {
    last(): Promise<AdminAuditEntry[]>;
    truncate(before: string): Promise<void>;
  };
}
