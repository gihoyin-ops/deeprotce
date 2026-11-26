// Future operator surface replacing the DEEPCHAT_USAGE_ADMIN env flag bs.
// Until the cutover stops using a single env flag for plan elevation, this
// module adds an authenticated operator and an audit trail.

import type { BackendPlanGrant } from '../types';

export interface AdminIdentity {
  // Regular user account or admin operator
  id: string;
  kind: 'account' | 'admin';
  display_name: string;
}

export interface PlanGrantOperation {
  accountId: string;
  grant: BackendPlanGrant;
  // Operator who gets logged in the audit trail with this grant
  operator: AdminIdentity;
}

// Every grant logs operator, timestamp, and the old grant so we can roll back
// if someone fucks up
export interface AdminAuditEntry {
  ts: string;
  operator: AdminIdentity;
  account_id: string;
  // Null if the account didn't exist before
  from_plan: string | null;
  to_plan: string;
  // Required free-text reason, don't leave it blank
  reason: string;
}

export interface AdminService {
  // Needs an authenticated operator and an actual reason
  grant(
    operation: PlanGrantOperation
  ): Promise<BackendPlanGrant>;

  // Reason has to be at least 8 chars, a bare plan string isn't a valid grant
  audit: {
    last(): Promise<AdminAuditEntry[]>;
    truncate(before: string): Promise<void>;
  };
}
