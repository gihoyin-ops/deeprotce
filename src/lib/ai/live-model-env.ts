// env-driven model entries: 'MODEL_ID|Display Name|description|maxEffort'
// - everything after the first '|' is optional ('id' alone still works like the old shit)
// - empty entries get skipped ('a,,b' is fine), whitespace trimmed per field
// - ids are case-sensitive and used verbatim because relays throw a fit otherwise
// - capped at 25 entries per env var so nobody nukes this with garbage
export interface ModelEnvEntry {
  id: string;
  name: string;
  description: string;
  maxEffort: string;
}

export const parseEffortTierIndex = (raw?: string): number | undefined => {
  const norm = (raw || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!norm) return undefined;
  if (norm === 'light' || norm === '0') return 0;
  if (norm === 'medium' || norm === '1') return 1;
  if (norm === 'high' || norm === '2') return 2;
  if (norm === 'extrahigh' || norm === 'xhigh' || norm === '3') return 3;
  if (norm === 'ultra' || norm === '4') return 4;
  return undefined;
};

export interface ModelMaxEffortConfig {
  byModel: Map<string, number>;
  defaultMax?: number;
}

export const parseModelMaxEffortEnv = (raw?: string): ModelMaxEffortConfig => {
  const byModel = new Map<string, number>();
  let defaultMax: number | undefined;

  for (const entry of (raw || '').split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    // support 'modelId|tier' or 'modelId=tier' (don't split on ':' because model IDs already use that shit)
    const sepIdx = trimmed.includes('|') ? trimmed.indexOf('|') : trimmed.indexOf('=');
    if (sepIdx === -1) {
      const globalTier = parseEffortTierIndex(trimmed);
      if (globalTier !== undefined) defaultMax = globalTier;
      continue;
    }

    const key = trimmed.slice(0, sepIdx).trim();
    const tier = parseEffortTierIndex(trimmed.slice(sepIdx + 1));
    if (tier === undefined) continue;

    if (key === '*' || key.toLowerCase() === 'default') {
      defaultMax = tier;
    } else if (key) {
      byModel.set(key, tier);
    }
  }

  return { byModel, defaultMax };
};

export const resolveMaxEffortIndex = (
  modelId: string,
  inlineMaxEffort?: string,
  config?: ModelMaxEffortConfig
): number => {
  const inline = parseEffortTierIndex(inlineMaxEffort);
  if (inline !== undefined) return inline;

  if (config) {
    const exact = config.byModel.get(modelId);
    if (exact !== undefined) return exact;
    if (config.defaultMax !== undefined) return config.defaultMax;
  }

  return 4;
};

const splitRawEntries = (val: string | readonly string[]): string[] => {
  if (typeof val !== 'string') {
    return val.map(item => item.trim()).filter(Boolean);
  }
  const merged: string[] = [];
  for (const line of val.split(/\r?\n/)) {
    for (const chunk of line.split(',')) {
      const firstField = (chunk.split('|')[0] ?? '').trim();
      // commas inside a description leave a chunk whose first field has spaces,
      // glue it back onto the previous entry instead of treating random prose as a model ID
      if (merged.length > 0 && /\s/.test(firstField)) {
        merged[merged.length - 1] = `${merged[merged.length - 1]},${chunk}`;
      } else {
        merged.push(chunk);
      }
    }
  }
  return merged;
};

export const splitModelEnv = (val: string | readonly string[]): ModelEnvEntry[] => {
  const out: ModelEnvEntry[] = [];
  for (const raw of splitRawEntries(val)) {
    const fields = raw.split('|').map(f => f.trim());
    const id = fields[0] ?? '';
    if (!id) continue;
    out.push({
      id,
      name: fields[1] ?? '',
      description: fields[2] ?? '',
      maxEffort: fields[3] ?? '',
    });
    if (out.length >= 25) break;
  }
  return out;
};
