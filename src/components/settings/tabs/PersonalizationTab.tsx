'use client';

import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import NextImage from 'next/image';
import { HelpCircle, X } from '@/components/ui/icons';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import Tooltip from '@/components/ui/Tooltip';
import {
  EMOJI_OPTIONS,
  ENTHUSIASTIC_OPTIONS,
  HEADERS_OPTIONS,
  STYLE_TONE_OPTIONS,
  VISUAL_ANSWERS_OPTIONS,
  WARMTH_OPTIONS
} from '../constants';
import { PillDropdown, type PillDropdownOption } from '../PillDropdown';
import type { DropdownOption } from '@/components/ui/CustomDropdown';
import type { PersonaState } from '../types';

interface PersonalizationTabProps {
  persona: PersonaState;
  onChange: (patch: Partial<PersonaState>) => void;
  isLoading: boolean;
  isSaving: boolean;
  onSave: (nextPersona?: PersonaState) => Promise<void> | void;
  onOpenMemories: () => void;
  onOpenMemoryDocs: () => void;
  webSearchEnabled: boolean;
  onToggleWebSearch: (enabled: boolean) => void;
}

const toPillOptions = (options: DropdownOption[]): PillDropdownOption[] =>
  options.map(opt =>
    typeof opt === 'string'
      ? { label: opt, value: opt }
      : { label: opt.label, value: opt.value, description: opt.description }
  );

export function PersonalizationTab({
  persona,
  onChange,
  isLoading,
  isSaving,
  onSave,
  onOpenMemories,
  onOpenMemoryDocs,
  webSearchEnabled,
  onToggleWebSearch
}: PersonalizationTabProps) {
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [draftInstructions, setDraftInstructions] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftOccupation, setDraftOccupation] = useState('');
  const [draftMore, setDraftMore] = useState('');

  const refPhotoInput = useRef<HTMLInputElement>(null);
  const fullBodyInput = useRef<HTMLInputElement>(null);

  const updateAndSave = (patch: Partial<PersonaState>) => {
    const next = { ...persona, ...patch };
    onChange(patch);
    void onSave(next);
  };

  const handlePhotoPicked = (
    event: React.ChangeEvent<HTMLInputElement>,
    field: 'referencePhoto' | 'fullBodyReferencePhoto'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateAndSave({ [field]: reader.result });
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const openCustomInstructions = () => {
    setDraftInstructions(persona.instructions || '');
    setDraftName(persona.aboutName || '');
    setDraftOccupation(persona.aboutOccupation || '');
    setDraftMore(persona.aboutMore || '');
    setIsCustomModalOpen(true);
  };

  const saveCustomInstructions = async () => {
    const patch: Partial<PersonaState> = {
      instructions: draftInstructions,
      aboutName: draftName,
      aboutOccupation: draftOccupation,
      aboutMore: draftMore
    };
    onChange(patch);
    await onSave({ ...persona, ...patch });
    setIsCustomModalOpen(false);
  };

  return (
    <div className={`space-y-8 ${isLoading ? 'pointer-events-none opacity-60' : ''}`} aria-busy={isLoading}>
      <header>
        <h3 className="text-2xl font-semibold tracking-tight text-[var(--dc-text-strong)]">Personalization</h3>
        <p className="mt-1 text-sm text-[var(--dc-text-muted)]">
          Customize how Benthos remembers you and responds across chats
        </p>
      </header>

      {/* Memory toggles and management */}
      <section>
        <div className="flex items-center justify-between border-b border-[var(--dc-border-subtle)] pb-3">
          <div className="flex items-center gap-1.5">
            <h4 className="text-base font-medium text-[var(--dc-text-strong)]">Memory</h4>
            <Tooltip label="Learn more about Memory" side="right">
              <button
                type="button"
                onClick={onOpenMemoryDocs}
                aria-label="Learn more about Memory"
                className="rounded-full p-1 text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </div>
        </div>

        <div className="divide-y divide-[var(--dc-border-subtle)]">
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Enable memory</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                Let Benthos save and use memories when responding
              </p>
            </div>
            <ToggleSwitch
              size="mobile"
              ariaLabel="Enable memory"
              checked={persona.memoryReferenceSaved}
              onChange={checked => updateAndSave({ memoryReferenceSaved: checked })}
            />
          </div>

          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Memory summary</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                Review, edit, or clear what Benthos remembers about you
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenMemories}
              className="shrink-0 rounded-full bg-[var(--dc-fill)] px-4 py-1.5 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill-hover)]"
            >
              Manage
            </button>
          </div>
        </div>
      </section>

      {/* Reference photos for image gen */}
      <section>
        <h4 className="border-b border-[var(--dc-border-subtle)] pb-3 text-base font-medium text-[var(--dc-text-strong)]">
          Reference photos
        </h4>

        <div className="divide-y divide-[var(--dc-border-subtle)]">
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Reference photo</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                This is the photo that Benthos refers to when you create an image of yourself
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {persona.referencePhoto && (
                <>
                  <NextImage
                    src={persona.referencePhoto}
                    alt="Reference photo"
                    width={32}
                    height={32}
                    unoptimized
                    className="h-8 w-8 rounded-full border border-[var(--dc-border)] object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => updateAndSave({ referencePhoto: '' })}
                    className="text-xs font-medium text-[var(--dc-text-muted)] hover:text-red-500"
                  >
                    Remove
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => refPhotoInput.current?.click()}
                className="rounded-full bg-[var(--dc-fill)] px-4 py-1.5 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill-hover)]"
              >
                {persona.referencePhoto ? 'Change' : 'Add'}
              </button>
              <input
                ref={refPhotoInput}
                type="file"
                accept="image/*"
                onChange={event => handlePhotoPicked(event, 'referencePhoto')}
                className="hidden"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Full-body reference photo</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                Used to show how clothing and accessories look on you
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {persona.fullBodyReferencePhoto && (
                <>
                  <NextImage
                    src={persona.fullBodyReferencePhoto}
                    alt="Full-body reference photo"
                    width={32}
                    height={32}
                    unoptimized
                    className="h-8 w-8 rounded-full border border-[var(--dc-border)] object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => updateAndSave({ fullBodyReferencePhoto: '' })}
                    className="text-xs font-medium text-[var(--dc-text-muted)] hover:text-red-500"
                  >
                    Remove
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => fullBodyInput.current?.click()}
                className="rounded-full bg-[var(--dc-fill)] px-4 py-1.5 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill-hover)]"
              >
                {persona.fullBodyReferencePhoto ? 'Change' : 'Add'}
              </button>
              <input
                ref={fullBodyInput}
                type="file"
                accept="image/*"
                onChange={event => handlePhotoPicked(event, 'fullBodyReferencePhoto')}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Style and tone dropdowns without a section header */}
      <section className="divide-y divide-[var(--dc-border-subtle)] border-t border-[var(--dc-border-subtle)]">
        <div className="flex items-center justify-between gap-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">Base style and tone</p>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
              Set the style and tone of how Benthos responds to you
            </p>
          </div>
          <PillDropdown
            value={persona.styleTone || 'default'}
            options={toPillOptions(STYLE_TONE_OPTIONS)}
            onChange={value => updateAndSave({ styleTone: value })}
            ariaLabel="Base style and tone"
          />
        </div>

        <div className="flex items-center justify-between gap-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">Warmth</p>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Adjust how warm and empathetic responses feel</p>
          </div>
          <PillDropdown
            value={persona.charWarm || 'default'}
            options={toPillOptions(WARMTH_OPTIONS)}
            onChange={value => updateAndSave({ charWarm: value })}
            ariaLabel="Warmth"
          />
        </div>

        <div className="flex items-center justify-between gap-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">Enthusiasm</p>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Adjust how energetic responses sound</p>
          </div>
          <PillDropdown
            value={persona.charEnthusiastic || 'default'}
            options={toPillOptions(ENTHUSIASTIC_OPTIONS)}
            onChange={value => updateAndSave({ charEnthusiastic: value })}
            ariaLabel="Enthusiasm"
          />
        </div>

        <div className="flex items-center justify-between gap-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">Emoji</p>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Control how frequently emojis appear in replies</p>
          </div>
          <PillDropdown
            value={persona.charEmoji || 'default'}
            options={toPillOptions(EMOJI_OPTIONS)}
            onChange={value => updateAndSave({ charEmoji: value })}
            ariaLabel="Emoji usage"
          />
        </div>

        <div className="flex items-center justify-between gap-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">Visual answer</p>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Prefer tables, diagrams, or plain text explanations</p>
          </div>
          <PillDropdown
            value={persona.charVisualAnswers || 'default'}
            options={toPillOptions(VISUAL_ANSWERS_OPTIONS)}
            onChange={value => updateAndSave({ charVisualAnswers: value })}
            ariaLabel="Visual answer preference"
          />
        </div>

        <div className="flex items-center justify-between gap-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">Header and list</p>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Control how structured responses are formatted</p>
          </div>
          <PillDropdown
            value={persona.charHeaders || 'default'}
            options={toPillOptions(HEADERS_OPTIONS)}
            onChange={value => updateAndSave({ charHeaders: value })}
            ariaLabel="Header and list formatting"
          />
        </div>
      </section>

      {/* Custom system instructions */}
      <section>
        <h4 className="border-b border-[var(--dc-border-subtle)] pb-3 text-base font-medium text-[var(--dc-text-strong)]">
          Custom instructions
        </h4>

        <div className="flex items-center justify-between gap-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">Benthos</p>
            <p className="mt-0.5 truncate text-xs text-[var(--dc-text-muted)]">
              {persona.instructions?.trim()
                ? persona.instructions.trim()
                : 'Customize how Benthos responds and what it knows about you'}
            </p>
          </div>
          <button
            type="button"
            onClick={openCustomInstructions}
            className="shrink-0 rounded-full bg-[var(--dc-fill)] px-4 py-1.5 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill-hover)]"
          >
            Edit
          </button>
        </div>
      </section>

      {/* Extra feature toggles */}
      <section>
        <h4 className="border-b border-[var(--dc-border-subtle)] pb-3 text-base font-medium text-[var(--dc-text-strong)]">
          Additional settings
        </h4>

        <div className="divide-y divide-[var(--dc-border-subtle)]">
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Suggested prompts</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                Benthos can suggest prompts using your chats, files, and connected tools.
              </p>
            </div>
            <ToggleSwitch
              size="mobile"
              ariaLabel="Suggested prompts"
              checked={persona.suggestedPrompts}
              onChange={checked => updateAndSave({ suggestedPrompts: checked })}
            />
          </div>

          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Reference record history</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                Let Benthos reference all previous chat transcripts and notes when responding.
              </p>
            </div>
            <ToggleSwitch
              size="mobile"
              ariaLabel="Reference record history"
              checked={persona.memoryReferenceHistory}
              onChange={checked => updateAndSave({ memoryReferenceHistory: checked })}
            />
          </div>

          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Web search</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                Let Benthos automatically search the web for answers
              </p>
            </div>
            <ToggleSwitch
              size="mobile"
              ariaLabel="Web search"
              checked={webSearchEnabled}
              onChange={onToggleWebSearch}
            />
          </div>

          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Library search</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                Allow Benthos to automatically search Library files for answers
              </p>
            </div>
            <ToggleSwitch
              size="mobile"
              ariaLabel="Library search"
              checked={persona.librarySearch}
              onChange={checked => updateAndSave({ librarySearch: checked })}
            />
          </div>
        </div>
      </section>

      {/* Custom instructions modal, portaled outside SettingsModal so it covers the whole damn screen */}
      {isCustomModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
          onClick={() => !isSaving && setIsCustomModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Custom instructions"
            className="w-full max-w-lg rounded-3xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-6 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-[var(--dc-text-strong)]">Custom instructions</h3>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsCustomModalOpen(false)}
                aria-label="Close custom instructions"
                className="rounded-full p-1 text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--dc-text-strong)]">
                  Custom instructions
                </label>
                <textarea
                  value={draftInstructions}
                  onChange={event => setDraftInstructions(event.target.value)}
                  rows={4}
                  placeholder="How would you like Benthos to respond?"
                  className="w-full resize-none rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3.5 py-2.5 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--dc-text-strong)]">
                    Nickname
                  </label>
                  <input
                    type="text"
                    value={draftName}
                    onChange={event => setDraftName(event.target.value)}
                    placeholder="What should Benthos call you?"
                    className="w-full rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3.5 py-2 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--dc-text-strong)]">
                    Occupation
                  </label>
                  <input
                    type="text"
                    value={draftOccupation}
                    onChange={event => setDraftOccupation(event.target.value)}
                    placeholder="Engineer, Designer, Student..."
                    className="w-full rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3.5 py-2 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-[var(--dc-text-strong)]">
                  More about you
                </label>
                <textarea
                  value={draftMore}
                  onChange={event => setDraftMore(event.target.value)}
                  rows={2}
                  placeholder="Interests, values, or preferences to keep in mind"
                  className="w-full resize-none rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3.5 py-2 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsCustomModalOpen(false)}
                className="rounded-full bg-[var(--dc-fill)] px-4 py-2 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill-hover)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void saveCustomInstructions()}
                className="rounded-full bg-[var(--dc-invert)] px-4 py-2 text-sm font-medium text-[var(--dc-text-on-invert)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
