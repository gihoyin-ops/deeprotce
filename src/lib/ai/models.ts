// Model config (mirrors LIVE_MODEL, LITE_MODEL, MODEL_MAX_EFFORT, IMAGE_MODEL, IMAGE_MODEL_FAST)
// Edit this file directly instead of screwing around with model lists in Vercel env vars
// Env vars override whatever is in here, so leave them unset in env if you want this file to win
//
// Entry format: 'MODEL_ID|Display Name|description|maxEffort'
// - Display Name, description, and maxEffort are optional bs
// - maxEffort: light | medium | high | extra-high | ultra (default: ultra)

export const MODEL_CONFIG = {
  // Main chat models (one entry per item, commas in description won't break shit)
  LIVE_MODEL: [
    'claude-sonnet-4-6|Claude Sonnet 4.6|Old generation of claude, Great for writing skills.|light',
    'deepseek-v4.1-flash|Deepseek V4.1 Flash|Great for balanced models. Fast and Good at Coding. Not for Complex Task.|high',
    'gemini-4-hydrogen|Gemini 4 Hydrogen|A fast and most intellegence than frontier like Gemini 3.1 Pro or Gemini 3.8 Flash.|ultra',
    'gpt-6-luna|GPT 6 Luna|Good at Coding and Math, Complex Task is enough.|ultra',
  ],

  // Lite models for cheap small-context garbage like chat titles and memory extraction
  LITE_MODEL: [
    'gemini-3.5-flash-lite|Gemini 3.5 Flash Lite|Fast and lightweight model for daily tasks.|light',
  ],

  // Optional per-model or global effort cap (same format as MODEL_MAX_EFFORT)
  // e.g. 'deepseek-v4.1|high,llama-3.1-8b|medium,*|extra-high'
  MODEL_MAX_EFFORT: '',

  // Image gen models (mirrors IMAGE_MODEL & IMAGE_MODEL_FAST)
  IMAGE_MODEL: 'gpt-image-2.5-sunburst',
  IMAGE_MODEL_FAST: 'gpt-image-2.5-flare',

  // Fallback model for guests when UI says Auto
  GUEST_MODEL: 'gemini-3.1-flash-lite',
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
