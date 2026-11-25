// Model configuration (mirrors LIVE_MODEL, LITE_MODEL, MODEL_MAX_EFFORT, IMAGE_MODEL, IMAGE_MODEL_FAST)
// Edit this file directly instead of managing model lists in Vercel env vars
// If an env var is set, it overrides the value here; leave it unset in env to use this file
//
// Entry format: 'MODEL_ID|Display Name|description|maxEffort'
// - Display Name, description, and maxEffort are optional
// - maxEffort: light | medium | high | extra-high | ultra (default: ultra)

export const MODEL_CONFIG = {
  // Main chat models (one entry per item, safe to use commas in description)
  LIVE_MODEL: [
    'claude-sonnet-4-6|Claude Sonnet 4.6|Old generation of claude, Great for writing skills.|light',
    'deepseek-v4.1-flash|Deepseek V4.1 Flash|Great for balanced models. Fast and Good at Coding. Not for Complex Task.|high',
    'gemini-4-hydrogen|Gemini 4 Hydrogen|A fast and most intellegence than frontier like Gemini 3.1 Pro or Gemini 3.8 Flash.|ultra',
    'gpt-6-luna|GPT 6 Luna|Good at Coding and Math, Complex Task is enough.|ultra',
  ],

  // Lite models for small-context tasks like chat titles & memory extraction
  LITE_MODEL: [
    'gemma4:31b|Gemma 4 31B|A Open Source Models From Google. Fast for daily task.|light',
  ],

  // Optional per-model or global effort cap (same format as MODEL_MAX_EFFORT)
  // Example: 'deepseek-v4.1|high,llama-3.1-8b|medium,*|extra-high'
  MODEL_MAX_EFFORT: '',

  // Image generation models (same as IMAGE_MODEL & IMAGE_MODEL_FAST)
  IMAGE_MODEL: 'gpt-image-2.5-sunburst',
  IMAGE_MODEL_FAST: 'gpt-image-2.5-flare',
} as const;

export type ModelConfigKey = keyof typeof MODEL_CONFIG;
export type ModelListConfigKey = 'LIVE_MODEL' | 'LITE_MODEL';
export type ModelStringConfigKey = Exclude<ModelConfigKey, ModelListConfigKey>;

export const getModelConfigValue = (key: ModelStringConfigKey): string => {
  const fromEnv = (process.env[key] || '').trim();
  return fromEnv || MODEL_CONFIG[key].trim();
};

export const getModelListConfigValue = (key: ModelListConfigKey): string | readonly string[] => {
  const fromEnv = (process.env[key] || '').trim();
  return fromEnv || MODEL_CONFIG[key];
};
