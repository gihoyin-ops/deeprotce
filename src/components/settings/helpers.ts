import type { ModelCategory, ModelCollection, ModelEntry, ModelItem } from './types';

// settings utility helpers

export const getErrorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export const isModelCategory = (model: ModelEntry | undefined): model is ModelCategory => Boolean(model && 'category' in model);

export const getVertexBaseUrl = (location: string) => `https://${location}-aiplatform.googleapis.com`;

export const getDefaultBaseUrl = (provider: string, map: Record<string, string>) => map[provider] || '';

export const dedupeModelItems = (models: ModelItem[]) => {
  const seen = new Set<string>();
  return models.filter(model => {
    if (!model.id || seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });
};

export const dedupeModelCollection = (models: ModelCollection): ModelCollection => models
  .map(model => (isModelCategory(model) ? { ...model, models: dedupeModelItems(model.models) } : model))
  .filter((model, index, collection) => {
    if (isModelCategory(model)) return model.models.length > 0;
    return !collection.slice(0, index).some(item => !isModelCategory(item) && item.id === model.id);
  });

export const formatStorageSize = (value: number | null) => {
  if (value === null) return 'Unavailable';
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
};

// parse error message
export const jsonOrThrow = async <T,>(response: Response, fallback: string): Promise<T> => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || fallback);
  return data as T;
};

// mobile menu section definitions
export const getMobileItemPosition = (sectionTitle: string, index: number, length: number) => {
  if (sectionTitle === 'Model & Services' && index >= 5) {
    return index === 5 ? 'top' : 'bottom';
  }
  if (sectionTitle === 'Model & Services' && index === 4) return 'bottom';
  if (length === 1) return 'single';
  if (index === 0) return 'top';
  if (index === length - 1) return 'bottom';
  return 'middle';
};

export const getMobileItemRadiusClass = (position: 'single' | 'top' | 'middle' | 'bottom') => {
  if (position === 'single') return 'rounded-[17px]';
  if (position === 'top') return 'rounded-t-[17px] rounded-b-[5px]';
  if (position === 'bottom') return 'rounded-t-[5px] rounded-b-[17px]';
  return 'rounded-[5px]';
};
