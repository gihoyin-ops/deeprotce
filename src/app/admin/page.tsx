import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isSessionActiveInDb, requireDbPool, type AccountRow } from '@/backend/db/account-session';
import AdminPanelClient from '@/components/admin/AdminPanelClient';
import { buildAuthLoginUrl } from '@/lib/auth/auth-url';
import { ACCOUNT_COOKIE_NAME } from '@/lib/security/auth';
import { verifyAccountClaims } from '@/lib/security/crypto';
import { isManagerStaffRole, parseRole } from '@/lib/security/roles';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(ACCOUNT_COOKIE_NAME)?.value;
  const verified = verifyAccountClaims(rawToken);

  if (!verified) {
    redirect(buildAuthLoginUrl());
  }

  try {
    const pool = await requireDbPool();
    const active = await isSessionActiveInDb(pool, verified.sid);
    if (!active) {
      redirect(buildAuthLoginUrl());
    }

    const rows = await pool.query<Pick<AccountRow, 'id' | 'role' | 'is_banned'>>(
      'SELECT id, role, is_banned FROM accounts WHERE id = ? LIMIT 1',
      [verified.sub]
    );
    const account = rows[0];
    if (!account || Number(account.is_banned) === 1) {
      redirect('/');
    }

    const role = parseRole(account.role) ?? 'user';
    if (!isManagerStaffRole(role)) {
      redirect('/');
    }
  } catch {
    redirect('/');
  }

  return <AdminPanelClient />;
}
