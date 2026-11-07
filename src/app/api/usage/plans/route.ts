import { NextResponse } from 'next/server';
import { PLAN_ORDER, PLANS, formatTokens } from '@/lib/security/plans';

export const runtime = 'nodejs';

// plan table for the UI, same cap on both the 5h and 7d windows

const listPlans = () =>
  PLAN_ORDER.map(id => {
    const plan = PLANS[id];
    return {
      id,
      label: plan.label,
      limitTokens: plan.limitTokens,
      limitLabel: formatTokens(plan.limitTokens),
      unlimited: !Number.isFinite(plan.limitTokens),
      windows: ['5h', '7d'] as const
    };
  });

export function GET() {
  return NextResponse.json({ ok: true, plans: listPlans() });
}
