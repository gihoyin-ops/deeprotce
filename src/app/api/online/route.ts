import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// tiny reachability probe used by the client OfflineGuard:
// any response (even a middleware 401/429) proves the network path is up
export async function GET() {
  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
