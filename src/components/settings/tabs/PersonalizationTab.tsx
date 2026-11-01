'use client';

import React from 'react';
import { Brain, CheckCircle2, HelpCircle, Loader2, Settings as SettingsIcon, User } from '@/components/ui/icons';
import CustomDropdown from '@/components/ui/CustomDropdown';
import { EMOJI_OPTIONS, ENTHUSIASTIC_OPTIONS, HEADERS_OPTIONS, STYLE_TONE_OPTIONS, WARMTH_OPTIONS } from '../constants';
import { PrimaryButton, TabHeader, ToggleRow } from '../primitives';
import type { PersonaState } from '../types';

interface PersonalizationTabProps {
  persona: PersonaState;
  onChange: (patch: Partial<PersonaState>) => void;
  isLoading: boolean;
  isSaving: boolean;
  onSave: () => void;
  onOpenMemories: () => void;
  onOpenMemoryDocs: () => void;
}

// user persona settings
export function PersonalizationTab({ persona, onChange, isLoading, isSaving, onSave, onOpenMemories, onOpenMemoryDocs }: PersonalizationTabProps) {
  return (
    <div className="space-y-8">
      <TabHeader title="Personalization" description="Set custom instructions to tailor how the AI responds to you across all chats." />

      <div className={`space-y-5 rounded-2xl border border-slate-100 bg-slate-50 p-5 dark:border-slate-700/60 dark:bg-slate-900/40 ${isLoading ? 'pointer-events-none opacity-70' : ''}`} aria-busy={isLoading}>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading personalization...
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Base Style &amp; Tone</label>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Select the primary way you want the AI to communicate with you.</p>
          <CustomDropdown value={persona.styleTone} onChange={value => onChange({ styleTone: value })} options={STYLE_TONE_OPTIONS} />
        </div>

        <hr className={dividerClass} />

        <div>
          <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <SettingsIcon className="h-4 w-4 text-indigo-500" /> Characteristics
          </h4>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Warmth</label>
                <CustomDropdown value={persona.charWarm} onChange={value => onChange({ charWarm: value })} options={WARMTH_OPTIONS} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Enthusiastic</label>
                <CustomDropdown value={persona.charEnthusiastic} onChange={value => onChange({ charEnthusiastic: value })} options={ENTHUSIASTIC_OPTIONS} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Headers &amp; Lists</label>
                <CustomDropdown value={persona.charHeaders} onChange={value => onChange({ charHeaders: value })} options={HEADERS_OPTIONS} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Emoji</label>
                <CustomDropdown value={persona.charEmoji} onChange={value => onChange({ charEmoji: value })} options={EMOJI_OPTIONS} />
              </div>
            </div>
          </div>
        </div>

        <hr className={dividerClass} />

        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
            <Brain className="h-4 w-4 text-indigo-500" /> System Instructions
          </label>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            How would you like the AI to respond? (e.g., format preferences, strict rules, languages).
          </p>
          <textarea
            value={persona.instructions}
            onChange={event => onChange({ instructions: event.target.value })}
            placeholder="e.g. Always provide code in TypeScript. Keep explanations brief."
            className="deepchat-field custom-scrollbar resize-none"
            rows={5}
          />
        </div>

        <hr className={dividerClass} />

        <div>
          <h4 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <User className="h-4 w-4 text-indigo-500" /> About You
          </h4>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Name</label>
              <input type="text" value={persona.aboutName} onChange={event => onChange({ aboutName: event.target.value })} placeholder="What should the AI call you?" className="deepchat-field py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Occupation / Role</label>
              <input type="text" value={persona.aboutOccupation} onChange={event => onChange({ aboutOccupation: event.target.value })} placeholder="e.g. Software Engineer, Student, Designer" className="deepchat-field py-2.5 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">More about you</label>
              <textarea value={persona.aboutMore} onChange={event => onChange({ aboutMore: event.target.value })} placeholder="What else should the AI know about you? (Hobbies, goals, preferences)" className="deepchat-field custom-scrollbar resize-none text-sm" rows={3} />
            </div>
          </div>
        </div>

        <hr className={dividerClass} />

        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">Memory</h4>
              <button
                type="button"
                onClick={onOpenMemoryDocs}
                className="group relative flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white hover:text-indigo-600 dark:hover:bg-slate-800 dark:hover:text-indigo-300"
                aria-label="Learn more about Memory"
              >
                <HelpCircle className="h-4 w-4" />
                <span className="deepchat-tooltip-content pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  Learn more
                </span>
              </button>
            </div>
            <button
              type="button"
              onClick={onOpenMemories}
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
            >
              Manage
            </button>
          </div>
          <div className="space-y-4">
            <ToggleRow
              title="Reference saved memories"
              description="Allow DeepChat to use saved information it remembers about you when creating more personal responses."
              checked={persona.memoryReferenceSaved}
              onChange={checked => onChange({ memoryReferenceSaved: checked })}
            />
            <ToggleRow
              title="Reference chat history"
              description="Allow DeepChat to reference previous chats to keep answers consistent with your recent context."
              checked={persona.memoryReferenceHistory}
              onChange={checked => onChange({ memoryReferenceHistory: checked })}
            />
          </div>
          <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-500/25 dark:bg-indigo-500/10">
            <p className="text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-300">
              DeepChat may use Memory to personalize queries to search providers, such as Bing.{' '}
              <button type="button" onClick={onOpenMemoryDocs} className="font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-200">
                Learn more
              </button>
            </p>
          </div>
        </div>

        <PrimaryButton onClick={onSave} loading={isSaving} icon={<CheckCircle2 className="h-4 w-4" />}>
          Save Personalization
        </PrimaryButton>
      </div>
    </div>
  );
}

const dividerClass = 'border-slate-200 dark:border-slate-700/60';
