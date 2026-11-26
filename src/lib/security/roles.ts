import type { AccountRole } from '@/backend/types';

export type { AccountRole };

export const ROLE_ORDER: AccountRole[] = ['user', 'staff', 'manager_staff'];

export const ROLE_LABELS: Record<AccountRole, string> = {
  user: 'User',
  staff: 'Staff',
  manager_staff: 'Manager Staff'
};

export const parseRole = (raw: unknown): AccountRole | null => {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'user') return 'user';
  if (normalized === 'staff' || normalized === 'staffs') return 'staff';
  if (
    normalized === 'manager_staff' ||
    normalized === 'manager-staff' ||
    normalized === 'manager staff' ||
    normalized === 'manager'
  ) {
    return 'manager_staff';
  }
  return null;
};

export const isStaffRole = (role: unknown): role is 'staff' | 'manager_staff' => {
  const parsed = parseRole(role);
  return parsed === 'staff' || parsed === 'manager_staff';
};

export const isManagerStaffRole = (role: unknown): role is 'manager_staff' => {
  return parseRole(role) === 'manager_staff';
};

export const formatRoleLabel = (role: unknown): string => {
  const parsed = parseRole(role) ?? 'user';
  return ROLE_LABELS[parsed];
};
