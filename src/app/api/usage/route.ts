import { NextResponse } from 'next/server';
import { PLAN_ORDER, PLANS, formatTokens, parsePlan } from '@/lib/security/plans';
import { USAGE_LEDGER_ENABLED, getUsageSnapshot, setIdentityPlan } from '@/lib/security/usage';
import { getClientIp } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';

// usage status and plan management for one identity (client IP)
// identity is the same key the rate limiter and chat meter use
// GET is read-only, POST needs DEEPCHAT_USAGE_ADMIN on the server
// chat gate stays in /api/chat, this route only reflects and manages

// the ledger is auto-off on serverless (shared identity, ephemeral
// storage) and can never be enabled there, so routes report that too

export async function GET(req: Request) {
  const identityKey = getClientIp(req).slice(0, 128);
  const snapshot = getUsageSnapshot(identityKey);

  if (!snapshot) {
    if (!USAGE_LEDGER_ENABLED) {
      return NextResponse.json({
        ok: true,
        available: false,
        enforced: false,
        error: 'usage ledger is off on serverless; limits not enforced'
      });
    }
    // store offline, fail open and say so
    return NextResponse.json({
      ok: true,
      available: false,
      enforced: false,
      error: 'usage store unavailable; limits not enforced'
    });
  }

  return NextResponse.json({
    ok: true,
    available: true,
    enforced: true,
    plan: snapshot.plan,
    planId: snapshot.planId,
    limitTokens: Number.isFinite(snapshot.limit) ? snapshot.limit : null,
    limitLabel: formatTokens(snapshot.limit),
    usedTokens: snapshot.used,
    remainingTokens: Number.isFinite(snapshot.remaining) ? snapshot.remaining : null,
    unlimited: snapshot.unlimited,
    windows: snapshot.windows.map(w => ({
      window: w.window,
      limitLabel: formatTokens(w.limit),
      usedTokens: w.used,
      remainingTokens: Number.isFinite(w.remaining) ? w.remaining : null,
      exhausted: w.exhausted,
      resetsAt: new Date(w.end).toISOString()
    }))
  });
}

const planChangesEnabled = () => {
  const value = process.env.DEEPCHAT_USAGE_ADMIN;
  return value === '1' || value === 'true';
};

export async function POST(req: Request) {
  const identityKey = getClientIp(req).slice(0, 128);

  if (!USAGE_LEDGER_ENABLED) {
    return NextResponse.json(
      { error: 'usage ledger is off on serverless; plan changes have no effect there', enforced: false },
      { status: 403 }
    );
  }

  if (!planChangesEnabled()) {
    return NextResponse.json(
      { error: 'plan changes are disabled server-side; set DEEPCHAT_USAGE_ADMIN=1 to enable them' },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json()) as { plan?: unknown };
    const planId = parsePlan(body.plan);
    if (!planId) {
      const known = PLAN_ORDER.join(', ');
      return NextResponse.json(
        { error: `unknown plan; valid: ${known}` },
        { status: 400 }
      );
    }

    setIdentityPlan(identityKey, planId);
    const snapshot = getUsageSnapshot(identityKey);

    return NextResponse.json({
      ok: true,
      plan: snapshot?.plan ?? PLANS[planId].label,
      planId,
      windows: (snapshot?.windows ?? []).map(w => ({
        window: w.window,
        usedTokens: w.used,
        remainingTokens: Number.isFinite(w.remaining) ? w.remaining : null,
        exhausted: w.exhausted,
        resetsAt: new Date(w.end).toISOString()
      }))
    });
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 });
  }
}
