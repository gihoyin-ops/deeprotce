import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Dead simple reachability ping for the client OfflineGuard,
// any response (even a 401/429 from middleware) proves the network isn't dead
export async function GET() {
  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
