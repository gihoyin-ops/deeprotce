// Free deterministic avatar generator via DiceBear v9 (no API key bs needed)
// Spits out unique illustrated avatars per user seed instead of boring ass letter initials

const DICEBEAR_STYLE = 'notionists-neutral';
const DICEBEAR_BACKGROUNDS = 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf';

export const buildDefaultAvatarUrl = (seed: string): string => {
  const cleanSeed = seed.trim() || 'deepchat-user';
  return `https://api.dicebear.com/9.x/${DICEBEAR_STYLE}/svg?seed=${encodeURIComponent(cleanSeed)}&backgroundColor=${DICEBEAR_BACKGROUNDS}`;
};

export const DEFAULT_GUEST_AVATAR = buildDefaultAvatarUrl('deepchat-guest');

export const isLegacyDefaultAvatar = (url?: string | null): boolean => {
  if (!url) return true;
  return (
    url.includes('api.dicebear.com/7.x/avataaars/svg?seed=Felix') ||
    url.includes('api.dicebear.com/7.x/initials/svg?seed=Guest')
  );
};

export const normalizeUsername = (raw: string): string =>
  raw
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .toLowerCase()
    .slice(0, 32);

const USERNAME_ADJECTIVES = [
  'amber', 'brisk', 'calm', 'clear', 'cosmic', 'crisp', 'dawn', 'deft',
  'gentle', 'kind', 'lucid', 'lunar', 'mellow', 'misty', 'nimble', 'noble',
  'quiet', 'rapid', 'serene', 'silver', 'solar', 'steady', 'swift', 'warm'
];

const USERNAME_NOUNS = [
  'atlas', 'birch', 'cedar', 'cloud', 'comet', 'dune', 'echo', 'falcon',
  'finch', 'forest', 'harbor', 'horizon', 'lynx', 'meadow', 'nebula', 'nova',
  'oak', 'orbit', 'otter', 'pebble', 'pine', 'river', 'spark', 'willow'
];

export const generateRandomUsername = (): string => {
  const adj = USERNAME_ADJECTIVES[Math.floor(Math.random() * USERNAME_ADJECTIVES.length)];
  const noun = USERNAME_NOUNS[Math.floor(Math.random() * USERNAME_NOUNS.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${adj}_${noun}_${num}`;
};
