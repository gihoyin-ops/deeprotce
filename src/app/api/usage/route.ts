import { NextResponse } from 'next/server';
import { PLAN_ORDER, PLANS, formatTokens, parsePlan } from '@/lib/security/plans';
import { USAGE_LEDGER_ENABLED, getUsageSnapshot, setIdentityPlan } from '@/lib/security/usage';
import { getClientIp } from '@/lib/security/rate-limit';
import { getVerifiedAccount, isGuestRequest } from '@/lib/security/auth';
import { getAccountUsageSnapshot, setAccountPlanInDb } from '@/backend/meter/turso-usage';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const verified = getVerifiedAccount(req.headers);

  if (!verified && isGuestRequest(req.headers)) {
    return NextResponse.json({
      ok: true,
      guest: true,
      available: false,
      enforced: false,
      error: 'usage is unavailable in guest mode; sign in to view account usage'
    });
  }

  let snapshot = verified ? await getAccountUsageSnapshot(verified.sub) : null;
  if (!snapshot) {
    const identityKey = verified ? `acc:${verified.sub}` : getClientIp(req).slice(0, 128);
    snapshot = getUsageSnapshot(identityKey);
  }

  if (!snapshot) {
    if (!USAGE_LEDGER_ENABLED) {
      return NextResponse.json({
        ok: true,
        available: false,
        enforced: false,
        error: 'usage store unavailable; configure Turso to track usage'
      });
    }
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
  const verified = getVerifiedAccount(req.headers);
  if (!verified && isGuestRequest(req.headers)) {
    return NextResponse.json(
      { error: 'guest_not_allowed', message: 'Sign in required to manage plan' },
      { status: 401 }
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

    let snapshot = null;
    if (verified) {
      await setAccountPlanInDb(verified.sub, planId);
      snapshot = await getAccountUsageSnapshot(verified.sub);
    }

    if (!snapshot) {
      if (!USAGE_LEDGER_ENABLED) {
        return NextResponse.json(
          { error: 'usage store unavailable on serverless without Turso', enforced: false },
          { status: 503 }
        );
      }
      const identityKey = verified ? `acc:${verified.sub}` : getClientIp(req).slice(0, 128);
      setIdentityPlan(identityKey, planId);
      snapshot = getUsageSnapshot(identityKey);
    }

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
