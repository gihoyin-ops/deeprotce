import { NextResponse } from 'next/server';
import { splitModelEnv } from '@/lib/ai/live-model-env';

export const runtime = 'nodejs';

interface EnvModelItem {
  id: string;
  name: string;
  badge?: string;
  description?: string;
}

const env = (key: string) => (process.env[key] || '').trim();

const formatFrontendModelName = (id: string): string => {
  const lower = id.toLowerCase();
  if (lower.includes('gemma')) return 'Gemma 4';
  if (lower.includes('llama')) return 'Llama 4';
  if (lower.includes('gpt-4o')) return 'GPT-4o';
  if (lower.includes('gpt-4')) return 'GPT-4';
  if (lower.includes('claude-3-5') || lower.includes('claude-3.5')) return 'Claude 3.5';
  if (lower.includes('claude')) return 'Claude 3';
  if (lower.includes('deepseek')) return 'DeepSeek R1';
  if (lower.startsWith('qwen3.8')) return 'Qwen 3.8';
  const clean = id.replace(/:[\w.-]+/g, '').replace(/[-_]/g, ' ').trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : id;
};

const getModelDescription = (id: string, name?: string): string => {
  const target = `${id} ${name || ''}`.toLowerCase();
  if (target.includes('gemma')) {
    return 'Model by Google, specialized in deep reasoning, coding, and multilingual dialogue';
  }
  if (target.includes('llama')) {
    return 'Model by Meta, specialized in versatile conversation, logic, and general knowledge';
  }
  if (target.includes('deepseek')) {
    return 'Model by DeepSeek, specialized in advanced mathematics, code, and step-by-step logic';
  }
  if (target.includes('gpt-4o')) {
    return 'Model by OpenAI, specialized in high-speed multimodal intelligence and complex tasks';
  }
  if (target.includes('gpt-4')) {
    return 'Model by OpenAI, specialized in broad problem solving, writing, and deep analysis';
  }
  if (target.includes('claude-3-5') || target.includes('claude-3.5')) {
    return 'Model by Anthropic, specialized in nuanced coding, detailed writing, and analysis';
  }
  if (target.includes('claude')) {
    return 'Model by Anthropic, specialized in safe reasoning, creative tasks, and writing';
  }
  if (target.includes('gemini')) {
    return 'Model by Google, specialized in multimodal processing and long-context reasoning';
  }
  if (target.includes('mistral') || target.includes('codestral')) {
    return 'Model by Mistral AI, specialized in fast reasoning and concise generation';
  }
  if (target.includes('qwen')) {
    return 'Model by Alibaba Cloud, specialized in multilingual reasoning and programming';
  }
  if (target.includes('phi')) {
    return 'Model by Microsoft, specialized in compact high-efficiency reasoning';
  }
  return 'High-performance AI model specialized in reasoning and conversational tasks';
};

const parseModelsFromEnv = (val: string, badge?: string): EnvModelItem[] => {
  return splitModelEnv(val).map(e => {
    const name = e.name || formatFrontendModelName(e.id);
    return {
      id: e.id,
      name,
      badge,
      description: e.description || getModelDescription(e.id, name)
    };
  });
};
// return env models only, skip remote fetch
export async function GET() {
  const models: EnvModelItem[] = [];
  const seen = new Set<string>();

  const add = (items: EnvModelItem[]) => {
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        models.push(item);
      }
    }
  };

  // main chat models from LIVE_MODEL
  add(parseModelsFromEnv(env('LIVE_MODEL'), 'Default'));

  // lite models from LITE_MODEL
  add(parseModelsFromEnv(env('LITE_MODEL'), 'Lite'));

  // provide defaults if no env models configured
  if (models.length === 0) {
    add([
      {
        id: 'gemma4:31b',
        name: 'Gemma 4',
        badge: 'Default',
        description: getModelDescription('gemma4:31b', 'Gemma 4')
      },
      {
        id: 'llama4:70b',
        name: 'Llama 4',
        badge: 'Lite',
        description: getModelDescription('llama4:70b', 'Llama 4')
      }
    ]);
  }
  const defaultModel = splitModelEnv(env('LIVE_MODEL'))[0]?.id || env('LIVE_MODEL').split(',')[0]?.trim() || models[0]?.id || '';

  return NextResponse.json({
    default: defaultModel,
    models
  });
}
