'use client';

import React from 'react';
import { CheckCircle2, Loader2, Plus, Settings as SettingsIcon, Zap } from '@/components/ui/icons';
import CustomDropdown from '@/components/ui/CustomDropdown';
import { REASONING_LEVEL_OPTIONS } from '../constants';
import { PrimaryButton, TabHeader, ToggleRow } from '../primitives';
import type { Connection, LLMDraft } from '../types';

interface ConnectionTabProps {
  connections: Connection[];
  isLoading: boolean;
  llm: LLMDraft;
  isLLMLoading: boolean;
  isLLMSaving: boolean;
  onLLMChange: (patch: Partial<LLMDraft>) => void;
  onSaveLLM: () => void;
  onVerify: (connection: Connection) => void;
  onEdit: (connection: Connection) => void;
  onAdd: () => void;
  onShowAll: () => void;
}

const secondaryButton = 'rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300';

// profiles and default llm settings
export function ConnectionTab({ connections, isLoading, llm, isLLMLoading, isLLMSaving, onLLMChange, onSaveLLM, onVerify, onEdit, onAdd, onShowAll }: ConnectionTabProps) {
  const visibleProfiles = connections.slice(0, 4);

  return (
    <div className="space-y-6">
      <TabHeader title="Connection" description="Manage provider profiles and default LLM behavior." />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100">Connection Profile</h4>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Your active provider profiles, limited to four for quick scanning.</p>
          </div>
          {connections.length > 4 && (
            <button onClick={onShowAll} className={secondaryButton}>Show more</button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {isLoading ? (
            <div className="col-span-full flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 py-8 font-medium text-slate-500 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading connections...
            </div>
          ) : visibleProfiles.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center font-medium text-slate-500 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-400">
              No connections configured yet.
            </div>
          ) : (
            visibleProfiles.map(connection => (
              <div key={connection.id} className="group flex min-h-[132px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-200 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-900/60 dark:hover:border-indigo-500/40">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-lg font-extrabold text-indigo-600 shadow-inner dark:bg-indigo-500/15 dark:text-indigo-300">
                    {connection.provider.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-slate-800 dark:text-slate-100">{connection.name}</p>
                    <p className="mt-1 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                      {connection.provider} {connection.model ? `• ${connection.model}` : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-700/60">
                  <button onClick={() => onVerify(connection)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-amber-50 hover:text-amber-600 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-amber-500/10 dark:hover:text-amber-300" title="Verify Connection">
                    <Zap className="h-4 w-4" />Verify
                  </button>
                  <button onClick={() => onEdit(connection)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300" title="Edit Connection">
                    <SettingsIcon className="h-4 w-4" />Edit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          onClick={onAdd}
          className="group flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 px-5 py-5 font-bold text-slate-500 transition-all hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-slate-700/70 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 transition-colors group-hover:bg-indigo-100 dark:bg-slate-800/60 dark:group-hover:bg-indigo-500/20">
            <Plus className="h-5 w-5" />
          </span>
          <span className="text-left">
            <p className="text-sm font-extrabold">Add Connection</p>
            <p className="text-xs font-medium text-slate-400 group-hover:text-indigo-500 dark:text-slate-500 dark:group-hover:text-indigo-300">Create another provider profile</p>
          </span>
        </button>
      </section>

      <section className="space-y-4">
        <div>
          <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100">LLM Settings</h4>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Set default response behavior for every provider connection.</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <ToggleRow
            title="Streaming response"
            description="Show tokens as they arrive from the provider. Turn this off to wait for a complete response before DeepChat displays it."
            checked={llm.streamingResponse}
            onChange={checked => onLLMChange({ streamingResponse: checked })}
            disabled={isLLMLoading}
          />
          <ToggleRow
            title="Reasoning"
            description="Enable a thinking preference for supported reasoning models. Providers that do not support reasoning will continue with normal chat behavior."
            checked={llm.reasoning}
            onChange={checked => onLLMChange({ reasoning: checked })}
            disabled={isLLMLoading}
          />
          <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60 ${llm.reasoning ? '' : 'opacity-70'}`}>
            <div className="mb-3">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Reasoning level</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">Choose how much thinking budget supported models should prefer, similar to OpenAI reasoning effort.</p>
            </div>
            <CustomDropdown value={llm.reasoningLevel} onChange={value => onLLMChange({ reasoningLevel: value as LLMDraft['reasoningLevel'] })} options={REASONING_LEVEL_OPTIONS} />
          </div>
        </div>

        <PrimaryButton onClick={onSaveLLM} loading={isLLMSaving} disabled={isLLMLoading} icon={<CheckCircle2 className="h-4 w-4" />}>
          Save LLM Settings
        </PrimaryButton>
      </section>
    </div>
  );
}
