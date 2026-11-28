import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ensureTursoSchema } from '@/backend/db/connection';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const cleanHandle = decodeURIComponent(username || '').trim().replace(/^@+/, '');

  if (cleanHandle) {
    try {
      const pool = await ensureTursoSchema();
      if (pool) {
        const rows = await pool.query<{ display_name: string; username: string | null }>(
          'SELECT display_name, username FROM accounts WHERE LOWER(username) = ? OR id = ? LIMIT 1',
          [cleanHandle.toLowerCase(), cleanHandle]
        );
        const row = rows[0];
        if (row) {
          const handle = row.username || cleanHandle;
          return {
            title: `${row.display_name} (@${handle}) / Benthos`,
          };
        }
      }
    } catch {
      // Eat the error and fall back if the DB is down during metadata generation
    }
  }

  return {
    title: cleanHandle ? `@${cleanHandle} / Benthos` : 'Profile / Benthos',
  };
}

export default function UserProfileLayout({ children }: { children: ReactNode }) {
  return children;
}
