// Free deterministic avatar generator via DiceBear v9 (no API key required)
// Produces unique illustrated avatars per user seed instead of plain letter initials

const DICEBEAR_STYLE = 'notionists-neutral';
const DICEBEAR_BACKGROUNDS = 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf';

export const buildDefaultAvatarUrl = (seed: string): string => {
  const cleanSeed = seed.trim() || 'deepchat-user';
  return `https://api.dicebear.com/9.x/${DICEBEAR_STYLE}/svg?seed=${encodeURIComponent(cleanSeed)}&backgroundColor=${DICEBEAR_BACKGROUNDS}`;
};
