'use client';

import { useCallback, useEffect, useState } from 'react';
import { isImageGenerationModel } from '@/lib/images/image-generation';

export interface SelectedModel {
  id: string;
  name: string;
  connectionId: string;
}

export interface ModelOption {
  id: string;
  name: string;
  badge?: string;
  description?: string;
  maxTierIndex?: number;
}

export interface ModelTier {
  key: string;
  valuetext: string;
  speed: string;
}

export const TIERS: ModelTier[] = [
  { key: 'Light', valuetext: 'Light - fastest', speed: 'Ultra Fast' },
  { key: 'Medium', valuetext: 'Medium - balanced', speed: 'Fast' },
  { key: 'High', valuetext: 'High - smarter', speed: 'Thinking' },
  { key: 'Extra High', valuetext: 'Extra High - much smarter', speed: 'Deep Thinking' },
  { key: 'Ultra', valuetext: 'Ultra - smartest, consumes usage limits faster', speed: 'Max Reasoning' },
];

export const LIVE_CHAT_CONNECTION_ID = 'live-chat';
export const LIVE_LITE_CONNECTION_ID = 'live-lite';

export const formatFrontendModelName = (modelId: string, modelName?: string): string => {
  const explicit = modelName?.trim();
  if (explicit) return explicit;

  const clean = modelId.replace(/:[\w.-]+/g, '').replace(/[-_]/g, ' ').trim();
  if (!clean) return modelId;
  return clean
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ');
};

export const getMaxTierIndexForModel = (models: ModelOption[], modelId: string): number => {
  const found = models.find((m) => m.id === modelId);
  if (typeof found?.maxTierIndex === 'number' && Number.isFinite(found.maxTierIndex)) {
    return Math.min(4, Math.max(0, Math.round(found.maxTierIndex)));
  }
  return 4;
};

export const getModelDescription = (_modelId: string, _modelName?: string, rawDesc?: string): string => {
  const trimmed = rawDesc?.trim();
  if (trimmed && trimmed !== 'Main chat model' && trimmed !== 'Fast & lightweight tasks') {
    return trimmed;
  }
  return '';
};

export const DEFAULT_FALLBACK_MODELS: ModelOption[] = [
  {
    id: 'gemma4:31b',
    name: 'Gemma 4',
  },
  {
    id: 'llama4:70b',
    name: 'Llama 4',
  },
];

export const DEFAULT_SELECTED_MODEL: SelectedModel = {
  id: 'gemma4:31b',
  name: 'Gemma 4',
  connectionId: LIVE_CHAT_CONNECTION_ID,
};

export const getConnectionIdForModel = (modelId: string): string => {
  if (modelId.toLowerCase().includes('llama') || modelId.toLowerCase().includes('lite')) {
    return LIVE_LITE_CONNECTION_ID;
  }
  return LIVE_CHAT_CONNECTION_ID;
};

export const toSelectedModel = (option: ModelOption): SelectedModel => ({
  id: option.id,
  name: formatFrontendModelName(option.id, option.name),
  connectionId: getConnectionIdForModel(option.id),
});

export const persistModel = (model: SelectedModel) => {
  try {
    localStorage.setItem('selectedModelObj', JSON.stringify(model));
    localStorage.setItem('selectedModel', model.id);
  } catch {
    // ignore storage failures
  }
};

export const loadStoredModel = (): SelectedModel | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem('selectedModelObj');
    if (!saved) return null;
    const parsed = JSON.parse(saved) as Partial<SelectedModel>;
    if (!parsed.id) return null;
    return {
      id: parsed.id,
      name: formatFrontendModelName(parsed.id, parsed.name),
      connectionId: parsed.connectionId || getConnectionIdForModel(parsed.id),
    };
  } catch {
    return null;
  }
};

export const loadStoredEffort = (): number => {
  if (typeof window === 'undefined') return 1;
  try {
    const saved = localStorage.getItem('selectedModelEffort');
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 4) return parsed;
    }
  } catch {
    // ignore storage failures
  }
  return 1;
};

export const persistEffort = (index: number) => {
  try {
    localStorage.setItem('selectedModelEffort', String(index));
  } catch {
    // ignore storage failures
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('modelEffortChanged', { detail: index }));
  }
};

interface LiveModelsResult {
  models: ModelOption[];
  defaultId?: string;
}

let cachedLiveModels: LiveModelsResult | null = null;
let inflightLiveModels: Promise<LiveModelsResult> | null = null;

export const getCachedLiveModels = (): LiveModelsResult | null => cachedLiveModels;

export const fetchLiveModels = async (): Promise<LiveModelsResult> => {
  if (cachedLiveModels) return cachedLiveModels;
  if (inflightLiveModels) return inflightLiveModels;

  inflightLiveModels = fetch('/api/live/models', { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { default?: string; models?: ModelOption[] } | null) => {
      const sourceList = data?.models && data.models.length > 0 ? data.models : DEFAULT_FALLBACK_MODELS;
      const list = sourceList
        .filter((m) => m.badge !== 'Image' && !isImageGenerationModel(m.id))
        .map((m) => {
          const formattedName = formatFrontendModelName(m.id, m.name);
          const description = getModelDescription(m.id, formattedName, m.description);
          return {
            ...m,
            name: formattedName,
            description: description || undefined,
          };
        });

      const resolved: LiveModelsResult = {
        models: list.length > 0 ? list : DEFAULT_FALLBACK_MODELS,
        defaultId: data?.default,
      };
      cachedLiveModels = resolved;
      return resolved;
    })
    .catch(() => {
      const fallback: LiveModelsResult = { models: DEFAULT_FALLBACK_MODELS };
      cachedLiveModels = fallback;
      return fallback;
    })
    .finally(() => {
      inflightLiveModels = null;
    });

  return inflightLiveModels;
};

export function useSelectedModelState() {
  const cached = getCachedLiveModels();
  const [models, setModels] = useState<ModelOption[]>(() => cached?.models || []);
  const [loading, setLoading] = useState(() => !cached);
  const [selectedModel, setSelectedModel] = useState<SelectedModel>(DEFAULT_SELECTED_MODEL);
  const [tierIndex, setTierIndex] = useState<number>(1);

  useEffect(() => {
    let cancelled = false;

    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      const stored = loadStoredModel();
      if (stored && !isImageGenerationModel(stored.id)) {
        setSelectedModel(stored);
      }
      setTierIndex(loadStoredEffort());
    });

    void fetchLiveModels().then((result) => {
      if (cancelled) return;
      const list = result.models;
      setModels(list);
      setLoading(false);

      const stored = loadStoredModel();
      const found = stored && !isImageGenerationModel(stored.id) && list.find((m) => m.id === stored.id);
      let activeModelId = list[0].id;
      if (found) {
        const fresh = toSelectedModel(found);
        activeModelId = fresh.id;
        setSelectedModel(fresh);
        persistModel(fresh);
      } else {
        const defId = result.defaultId || list[0].id;
        const def = list.find((m) => m.id === defId) || list[0];
        const next = toSelectedModel(def);
        activeModelId = next.id;
        setSelectedModel(next);
        persistModel(next);
        window.dispatchEvent(new CustomEvent('modelSelected', { detail: next }));
      }

      const maxTier = getMaxTierIndexForModel(list, activeModelId);
      const currentEffort = loadStoredEffort();
      if (currentEffort > maxTier) {
        setTierIndex(maxTier);
        persistEffort(maxTier);
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const syncModel = () => {
      const stored = loadStoredModel();
      if (stored && !isImageGenerationModel(stored.id)) {
        setSelectedModel(stored);
      }
      setTierIndex(loadStoredEffort());
    };

    const syncEffort = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === 'number') {
        setTierIndex(event.detail);
      } else {
        setTierIndex(loadStoredEffort());
      }
    };

    window.addEventListener('storage', syncModel);
    window.addEventListener('modelSelected', syncModel);
    window.addEventListener('modelEffortChanged', syncEffort);

    return () => {
      window.removeEventListener('storage', syncModel);
      window.removeEventListener('modelSelected', syncModel);
      window.removeEventListener('modelEffortChanged', syncEffort);
    };
  }, []);

  const maxTierIndex = getMaxTierIndexForModel(models, selectedModel.id);

  const selectModel = useCallback((option: ModelOption) => {
    const next = toSelectedModel(option);
    setSelectedModel(next);
    persistModel(next);
    window.dispatchEvent(new CustomEvent('modelSelected', { detail: next }));

    const nextMax = typeof option.maxTierIndex === 'number'
      ? Math.min(4, Math.max(0, Math.round(option.maxTierIndex)))
      : 4;
    if (loadStoredEffort() > nextMax) {
      setTierIndex(nextMax);
      persistEffort(nextMax);
    }

    return next;
  }, []);

  const commitTier = useCallback(
    (index: number) => {
      const clamped = Math.min(maxTierIndex, Math.max(0, index));
      setTierIndex(clamped);
      persistEffort(clamped);
      return clamped;
    },
    [maxTierIndex]
  );

  const effectiveTierIndex = Math.min(tierIndex, maxTierIndex);
  const availableTiers = TIERS.slice(0, maxTierIndex + 1);
  const currentTier = TIERS[effectiveTierIndex] || TIERS[0];
  const isUltra = maxTierIndex >= 4 && effectiveTierIndex === 4;

  return {
    selectedModel,
    tierIndex: effectiveTierIndex,
    maxTierIndex,
    availableTiers,
    currentTier,
    isUltra,
    models,
    loading,
    selectModel,
    commitTier,
  };
}
