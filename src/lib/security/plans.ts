// Plan tiers + per-identity token limit
// Window budget is a security ceiling, not a billing meter
// Each window is capped at the plan number below

export type PlanId = 'free' | 'supporters' | 'cool' | 'owner';

export interface Plan {
  id: PlanId;
  label: string;
  /** per-window budget, Infinity is unlimited */
  limitTokens: number;
}

export const PLANS: Record<PlanId, Plan> = {
  free: { id: 'free', label: 'Free', limitTokens: 40_000_000 },
  supporters: { id: 'supporters', label: 'Supporters', limitTokens: 150_000_000 },
  cool: { id: 'cool', label: 'Cools', limitTokens: 650_000_000 },
  owner: { id: 'owner', label: 'Owner', limitTokens: Infinity }
};

/** tier order, low to high */
export const PLAN_ORDER: PlanId[] = ['free', 'supporters', 'cool', 'owner'];

/** default tier for a new identity */
export const DEFAULT_PLAN: PlanId = 'free';

// aliases accepted, singular and plural, case-insensitive, unknown never maps
const PLAN_ALIASES: Record<string, PlanId> = {
  free: 'free',
  supporters: 'supporters',
  supporter: 'supporters',
  support: 'supporters',
  cool: 'cool',
  cools: 'cool',
  owner: 'owner',
  owners: 'owner'
};

export const parsePlan = (raw: unknown): PlanId | null => {
  if (typeof raw !== 'string') return null;
  return PLAN_ALIASES[raw.trim().toLowerCase()] ?? null;
};

export const getPlan = (id: PlanId): Plan => PLANS[id];

export const isUnlimitedPlan = (id: PlanId): boolean =>
  !Number.isFinite(PLANS[id].limitTokens);

/** token count like 40M, 150M, 650M, or ∞ */
export const formatTokens = (tokens: number): string => {
  if (!Number.isFinite(tokens)) return '∞';
  const n = Math.round(tokens);
  if (n >= 1_000_000_000) return `${trimZeros((n / 1_000_000_000).toFixed(2))}B`;
  if (n >= 1_000_000) return `${trimZeros((n / 1_000_000).toFixed(2))}M`;
  if (n >= 1_000) return `${trimZeros((n / 1_000).toFixed(1))}K`;
  return String(n);
};

const trimZeros = (value: string): string => value.replace(/\.?0+$/, '');
