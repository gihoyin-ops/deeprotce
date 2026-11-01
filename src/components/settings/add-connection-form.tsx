'use client';

import React, { useState } from 'react';
import { RefreshCw } from '@/components/ui/icons';
import toast from 'react-hot-toast';
import CustomDropdown from '@/components/ui/CustomDropdown';
import CustomModelDropdown from '@/components/ui/CustomModelDropdown';
import geminiModels from '@/lib/ai/gemini-models';
import { DEFAULT_BASE_URL_BY_PROVIDER, PROVIDER_OPTIONS, VERTEX_LOCATION_OPTIONS } from './constants';
import { dedupeModelCollection, getDefaultBaseUrl as resolveDefaultBaseUrl, getErrorMessage, getVertexBaseUrl, isModelCategory } from './helpers';
import type { Connection, ModelCollection, ModelItem } from './types';

// add connection dialog form
export function AddConnectionForm({ initialData, onSave, onDelete }: {
  initialData: Connection | null;
  onSave: (data: Connection) => void;
  onDelete: (id: string) => void;
}) {
  const [formData, setFormData] = useState<Connection>({
    id: initialData?.id || '',
    provider: initialData?.provider || 'OpenAI Compatible',
    name: initialData?.name || '',
    apiKey: initialData?.apiKey || '',
    baseUrl: initialData?.baseUrl || '',
    projectId: initialData?.projectId || '',
    location: initialData?.location || 'us-central1',
    model: initialData?.model || '',
  });

  const [models, setModels] = useState<ModelCollection>(initialData?.provider === 'Gemini' ? geminiModels as ModelCollection : []);
  const [loadingModels, setLoadingModels] = useState(false);
  const initialProvider = initialData?.provider;
  const effectiveFormData = formData.provider === 'VertexAI'
    ? { ...formData, baseUrl: getVertexBaseUrl(formData.location) }
    : { ...formData, baseUrl: formData.baseUrl || resolveDefaultBaseUrl(formData.provider, DEFAULT_BASE_URL_BY_PROVIDER) };

  const updateFormData = (patch: Partial<Connection>) => {
    setFormData(prev => ({ ...prev, ...patch }));
  };

  const handleProviderChange = (provider: string) => {
    updateFormData({
      provider,
      baseUrl: resolveDefaultBaseUrl(provider, DEFAULT_BASE_URL_BY_PROVIDER)
    });
    if (provider === 'Gemini') {
      setModels(geminiModels as ModelCollection);
    } else if (provider !== initialProvider) {
      setModels([]);
    }
  };

  const fetchModels = async () => {
    if (!formData.apiKey) {
      toast.error('API Key is required to fetch models');
      return;
    }
    setLoadingModels(true);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(effectiveFormData)
      });
      const data = await res.json() as { models?: ModelCollection; error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to fetch models');

      const newModels = dedupeModelCollection(data.models || []);
      setModels(newModels);

      if (newModels.length > 0 && !formData.model) {
        if (isModelCategory(newModels[0])) {
          const firstModel = newModels.filter(isModelCategory).flatMap(c => c.models)[0];
          if (firstModel) setFormData(p => ({ ...p, model: firstModel.id }));
        } else {
          setFormData(p => ({ ...p, model: (newModels[0] as ModelItem).id }));
        }
      }
      toast.success('Models fetched successfully');
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to fetch models'));
    }
    setLoadingModels(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">Provider</label>
        <CustomDropdown
          value={formData.provider}
          onChange={handleProviderChange}
          options={PROVIDER_OPTIONS}
        />
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">Connection Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={e => updateFormData({ name: e.target.value })}
          placeholder="e.g. My Primary AI"
          className="deepchat-field"
        />
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">API Key</label>
        <input
          type="password"
          value={formData.apiKey}
          onChange={e => updateFormData({ apiKey: e.target.value })}
          placeholder="sk-..."
          className="deepchat-field"
        />
      </div>

      {formData.provider === 'OpenAI Compatible' && (
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Base URL</label>
          <input
            type="text"
            value={formData.baseUrl}
            onChange={e => updateFormData({ baseUrl: e.target.value })}
            placeholder={resolveDefaultBaseUrl(formData.provider, DEFAULT_BASE_URL_BY_PROVIDER) || 'https://api...'}
            className="deepchat-field"
          />
        </div>
      )}

      {formData.provider === 'VertexAI' && (
        <>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Project ID</label>
            <input
              type="text"
              value={formData.projectId}
              onChange={e => updateFormData({ projectId: e.target.value })}
              placeholder="e.g. my-gcp-project-123"
              className="deepchat-field"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Location</label>
            <CustomDropdown
              value={formData.location}
              onChange={val => updateFormData({ location: val })}
              options={VERTEX_LOCATION_OPTIONS}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Generated Base URL</label>
            <input
              type="text"
              value={effectiveFormData.baseUrl}
              readOnly
              className="w-full bg-slate-100 text-slate-500 border border-slate-200 rounded-xl px-4 py-3 outline-none font-medium cursor-not-allowed"
            />
          </div>
        </>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-bold text-slate-700">Default Model</label>
          <button onClick={fetchModels} disabled={loadingModels} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loadingModels ? 'animate-spin' : ''}`} />
            Fetch Models
          </button>
        </div>
        {models.length > 0 ? (
          isModelCategory(models[0]) ? (
            <CustomModelDropdown
              value={formData.model}
              onChange={(val: string) => updateFormData({ model: val })}
              models={models}
            />
          ) : (
            <select
              value={formData.model}
              onChange={e => updateFormData({ model: e.target.value })}
              className="deepchat-field appearance-none"
            >
              <option value="">Select a model</option>
              {models.filter((model): model is ModelItem => !isModelCategory(model)).map((m, index) => (
                <option key={`${m.id}-${index}`} value={m.id}>{m.name}</option>
              ))}
            </select>
          )
        ) : (
          <input
            type="text"
            value={formData.model}
            onChange={e => updateFormData({ model: e.target.value })}
            placeholder="e.g. gpt-4, claude-3-opus, etc."
            className="deepchat-field"
          />
        )}
      </div>

      <div className="flex items-center gap-3 pt-4">
        <button onClick={() => onSave(effectiveFormData)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-colors">
          Save Connection
        </button>
        {initialData && (
          <button onClick={() => onDelete(initialData.id)} className="px-5 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold transition-colors">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
