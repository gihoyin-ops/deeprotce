import { NextResponse } from 'next/server';
import { ACCOUNT_COOKIE_NAME, isGuestRequest } from '@/lib/security/auth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const guest = isGuestRequest(req.headers);
  return NextResponse.json({
    ok: true,
    authenticated: !guest,
    guest,
  });
}

export async function DELETE() {
  const response = NextResponse.json({
    ok: true,
    authenticated: false,
    guest: true,
  });
  response.headers.set(
    'set-cookie',
    `${ACCOUNT_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`
  );
  return response;
}
