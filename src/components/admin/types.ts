import type { AccountRole } from '@/lib/security/roles';

export type AdminPlanChoice = 'free' | 'supporters' | 'cool';

export interface AdminUserItem {
  id: string;
  email: string;
  username: string | null;
  displayName: string;
  avatarUrl: string;
  plan: string;
  role: AccountRole;
  isBanned: boolean;
  banReason: string | null;
  bannedAt: string | null;
  createdAt: string;
  updatedAt: string;
  activeSessions: number;
  subscription: {
    plan: string;
    grantedBy: string;
    validFrom: string;
    validUntil: string | null;
  } | null;
}

export interface AdminAuditItem {
  id: string;
  actorId: string;
  actorEmail: string;
  actorRole: AccountRole;
  action: string;
  targetAccountId: string | null;
  targetEmail: string | null;
  reason: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  activeStaff: number;
  managerStaff: number;
  bannedUsers: number;
  paidUsers: number;
}

export interface AdminOverviewResponse {
  actor: {
    id: string;
    email: string;
    displayName: string;
    role: AccountRole;
    avatarUrl: string;
  };
  stats: AdminStats;
  users: AdminUserItem[];
  auditLogs: AdminAuditItem[];
}
