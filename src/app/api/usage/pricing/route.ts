import { NextResponse } from 'next/server';
import { PLAN_ORDER, PLANS } from '@/lib/security/plans';

export const runtime = 'nodejs';

type RegionCode = 'US' | 'CN' | 'ID' | 'JP' | 'RU';

const VALID_REGIONS = new Set<RegionCode>(['US', 'CN', 'ID', 'JP', 'RU']);

const REGION_PRICES: Record<RegionCode, Record<'free' | 'supporters' | 'cool', string>> = {
  US: { free: '$0', supporters: '$12', cool: '$29' },
  CN: { free: '¥0', supporters: '¥68', cool: '¥168' },
  ID: { free: 'Rp 0', supporters: 'Rp 79.000', cool: 'Rp 199.000' },
  JP: { free: '¥0', supporters: '¥1,800', cool: '¥4,200' },
  RU: { free: '₽0', supporters: '₽890', cool: '₽2,190' }
};

export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawRegion = (searchParams.get('region') || 'US').toUpperCase() as RegionCode;
  const region: RegionCode = VALID_REGIONS.has(rawRegion) ? rawRegion : 'US';
  const priceMap = REGION_PRICES[region];

  const plans = PLAN_ORDER.filter(id => id !== 'staff').map(id => {
    const plan = PLANS[id];
    const price =
      id === 'free' || id === 'supporters' || id === 'cool'
        ? priceMap[id]
        : priceMap.free;
    return {
      id: plan.id,
      label: plan.label,
      price,
      period: '/ month'
    };
  });

  return NextResponse.json({
    ok: true,
    region,
    plans
  });
}
