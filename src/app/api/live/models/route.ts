import { NextResponse } from 'next/server';
import {
  parseModelMaxEffortEnv,
  resolveMaxEffortIndex,
  splitModelEnv,
} from '@/lib/ai/live-model-env';
import { getModelConfigValue, getModelListConfigValue } from '@/lib/ai/models';

export const runtime = 'nodejs';

interface EnvModelItem {
  id: string;
  name: string;
  badge?: string;
  description?: string;
  maxTierIndex?: number;
}

const formatFrontendModelName = (id: string): string => {
  const clean = id.replace(/:[\w.-]+/g, '').replace(/[-_]/g, ' ').trim();
  if (!clean) return id;
  return clean
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ');
};

const parseModelsFromEnv = (
  val: string | readonly string[],
  badge: string | undefined,
  effortConfig: ReturnType<typeof parseModelMaxEffortEnv>
): EnvModelItem[] => {
  return splitModelEnv(val).map(e => {
    const name = e.name || formatFrontendModelName(e.id);
    return {
      id: e.id,
      name,
      badge,
      description: e.description || undefined,
      maxTierIndex: resolveMaxEffortIndex(e.id, e.maxEffort, effortConfig),
    };
  });
};
// return env models only, skip remote fetch
export async function GET() {
  const models: EnvModelItem[] = [];
  const seen = new Set<string>();
  const effortConfig = parseModelMaxEffortEnv(getModelConfigValue('MODEL_MAX_EFFORT'));

  const add = (items: EnvModelItem[]) => {
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        models.push(item);
      }
    }
  };

  const liveModelRaw = getModelListConfigValue('LIVE_MODEL');
  const liteModelRaw = getModelListConfigValue('LITE_MODEL');

  // main chat models from LIVE_MODEL
  add(parseModelsFromEnv(liveModelRaw, 'Default', effortConfig));

  // lite models from LITE_MODEL
  add(parseModelsFromEnv(liteModelRaw, 'Lite', effortConfig));

  const defaultModel = splitModelEnv(liveModelRaw)[0]?.id || models[0]?.id || '';

  return NextResponse.json({
    default: defaultModel,
    models
  });
}
