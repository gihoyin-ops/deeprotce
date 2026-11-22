import { NextResponse } from 'next/server';
import {
  parseModelMaxEffortEnv,
  resolveMaxEffortIndex,
  splitModelEnv,
} from '@/lib/ai/live-model-env';

export const runtime = 'nodejs';

interface EnvModelItem {
  id: string;
  name: string;
  badge?: string;
  description?: string;
  maxTierIndex?: number;
}

const env = (key: string) => (process.env[key] || '').trim();

const formatFrontendModelName = (id: string): string => {
  const clean = id.replace(/:[\w.-]+/g, '').replace(/[-_]/g, ' ').trim();
  if (!clean) return id;
  return clean
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ');
};

const parseModelsFromEnv = (
  val: string,
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
  const effortConfig = parseModelMaxEffortEnv(env('MODEL_MAX_EFFORT'));

  const add = (items: EnvModelItem[]) => {
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        models.push(item);
      }
    }
  };

  // main chat models from LIVE_MODEL
  add(parseModelsFromEnv(env('LIVE_MODEL'), 'Default', effortConfig));

  // lite models from LITE_MODEL
  add(parseModelsFromEnv(env('LITE_MODEL'), 'Lite', effortConfig));

  // provide defaults if no env models configured
  if (models.length === 0) {
    add([
      {
        id: 'gemma4:31b',
        name: 'Gemma 4',
        badge: 'Default',
        maxTierIndex: resolveMaxEffortIndex('gemma4:31b', undefined, effortConfig),
      },
      {
        id: 'llama4:70b',
        name: 'Llama 4',
        badge: 'Lite',
        maxTierIndex: resolveMaxEffortIndex('llama4:70b', undefined, effortConfig),
      }
    ]);
  }
  const defaultModel = splitModelEnv(env('LIVE_MODEL'))[0]?.id || env('LIVE_MODEL').split(',')[0]?.trim() || models[0]?.id || '';

  return NextResponse.json({
    default: defaultModel,
    models
  });
}
