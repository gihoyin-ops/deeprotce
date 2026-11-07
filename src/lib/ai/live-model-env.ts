// env-driven model list entries: 'MODEL_ID|Display Name|description'.
// - fields after the first '|' are optional ('id' alone keeps legacy behavior)
// - empty entries are skipped ('a,,b' is valid); whitespace trimmed per field
// - ids are case-sensitive and used verbatim (relays are case-sensitive)
// - capped at 25 entries per env var as a defensive guard
export interface ModelEnvEntry { id: string; name: string; description: string; }
export const splitModelEnv = (val: string): ModelEnvEntry[] => {
  const out: ModelEnvEntry[] = [];
  for (const raw of val.split(',')) {
    const fields = raw.split('|').map(f => f.trim());
    const id = fields[0] ?? '';
    if (!id) continue;
    out.push({ id, name: fields[1] ?? '', description: fields[2] ?? '' });
    if (out.length >= 25) break;
  }
  return out;
};
