// Plan tiers and per-identity token limits
// This window budget is a hard security ceiling, quit treating it like a billing meter
// Every window caps out at the plan numbers below

export type PlanId = 'free' | 'supporters' | 'cool' | 'staff';

export interface Plan {
  id: PlanId;
  label: string;
  /** per-window budget, Infinity means no cap at all */
  limitTokens: number;
}

export const PLANS: Record<PlanId, Plan> = {
  free: { id: 'free', label: 'Free', limitTokens: 40_000_000 },
  supporters: { id: 'supporters', label: 'Supporters', limitTokens: 150_000_000 },
  cool: { id: 'cool', label: 'Cools', limitTokens: 650_000_000 },
  staff: { id: 'staff', label: 'Staff', limitTokens: Infinity }
};

/** tier order from broke to baller */
export const PLAN_ORDER: PlanId[] = ['free', 'supporters', 'cool', 'staff'];

/** default tier for fresh identities */
export const DEFAULT_PLAN: PlanId = 'free';

// accepted aliases (singular/plural, case-insensitive), unknown shit returns null
const PLAN_ALIASES: Record<string, PlanId> = {
  free: 'free',
  supporters: 'supporters',
  supporter: 'supporters',
  support: 'supporters',
  cool: 'cool',
  cools: 'cool',
  staff: 'staff',
  staffs: 'staff'
};

export const parsePlan = (raw: unknown): PlanId | null => {
  if (typeof raw !== 'string') return null;
  return PLAN_ALIASES[raw.trim().toLowerCase()] ?? null;
};

export const getPlan = (id: PlanId): Plan => PLANS[id];

export const isUnlimitedPlan = (id: PlanId): boolean =>
  !Number.isFinite(PLANS[id].limitTokens);

/** format token count like 40M, 150M, 650M, or ∞ */
export const formatTokens = (tokens: number): string => {
  if (!Number.isFinite(tokens)) return '∞';
  const n = Math.round(tokens);
  if (n >= 1_000_000_000) return `${trimZeros((n / 1_000_000_000).toFixed(2))}B`;
  if (n >= 1_000_000) return `${trimZeros((n / 1_000_000).toFixed(2))}M`;
  if (n >= 1_000) return `${trimZeros((n / 1_000).toFixed(1))}K`;
  return String(n);
};

const trimZeros = (value: string): string => value.replace(/\.?0+$/, '');
