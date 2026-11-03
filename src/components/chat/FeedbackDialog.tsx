'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogHeader } from '@/components/settings/dialog';
import { Loader2 } from '@/components/ui/icons';
import type { MessageRating } from '@/lib/feedback/message-feedback';

type SubmitState = 'idle' | 'saving' | 'saved';

interface FeedbackDialogProps {
  open: boolean;
  closing: boolean;
  messageKind: 'error' | 'normal';
  // Reason chips shown in the sheet (error list is led by "Always Error Response").
  reasons: readonly string[];
  // Direction the sheet submits; set from the thumb the user tapped.
  rating: MessageRating;
  // Previously stored reasons/details for this rating, restored on re-open.
  initialReasons: string[];
  initialDetails: string;
  onClose: () => void;
  onSubmit: (rating: MessageRating, reasons: string[], details: string) => Promise<boolean>;
}

// "Share feedback" sheet opened from the message thumbs (Like or Dislike).
// The only input is the reason list for this message kind plus an optional
// details note; the direction itself was already chosen by the thumb tap, so
// re-tapping the active thumb outside the sheet is what clears the vote.
export function FeedbackDialog({ open, closing, messageKind, reasons, rating, initialReasons, initialDetails, onClose, onSubmit }: FeedbackDialogProps) {
  const [selectedReasons, setSelectedReasons] = useState<string[]>(initialReasons);
  const [details, setDetails] = useState(initialDetails);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  // The dialog remounts for every open, so the state above starts fresh; move
  // focus into the panel once it is on screen.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => firstFocusRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const toggleReason = (reason: string) => {
    setSelectedReasons(current => (current.includes(reason) ? current.filter(item => item !== reason) : [...current, reason]));
  };

  const handleSubmit = async () => {
    if (submitState === 'saving') return;
    setSubmitState('saving');
    const ok = await onSubmit(rating, selectedReasons, details.trim());
    if (ok) {
      setSubmitState('saved');
      window.setTimeout(onClose, 550);
    } else {
      setSubmitState('idle');
    }
  };

  // Focus trap: Tab / Shift+Tab stay inside the dialog, Escape closes it.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !wrapperRef.current) return;
    const focusables = wrapperRef.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === wrapperRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const heading = rating === 'like'
    ? (messageKind === 'error' ? 'What was good despite the error?' : 'Why was this helpful?')
    : (messageKind === 'error' ? 'What happened?' : 'What went wrong?');

  const chipClass = (active: boolean) =>
    `min-h-[44px] rounded-full border px-4 py-2 text-left text-[13px] font-semibold leading-snug transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--deepchat-accent)] dark:focus-visible:outline-[var(--deepchat-accent-text)] sm:text-sm ${
      active
        ? 'border-[var(--deepchat-accent)] bg-[var(--deepchat-accent-soft)] text-[var(--deepchat-accent-text)] dark:border-[var(--deepchat-accent-text)] dark:bg-slate-950'
        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
    }`;

  return (
    <div ref={wrapperRef} onKeyDown={handleKeyDown}>
      <Dialog open={open} closing={closing} zIndex={500} width="max-w-xl" onClose={onClose}>
        <DialogHeader
          title="Share feedback"
          description={messageKind === 'error' ? 'This response ran into a problem. Tell us what to look at.' : 'Tell us about this answer so we can do better.'}
          onClose={onClose}
        />
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:gap-5 sm:p-6">
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 block text-sm font-bold text-slate-800 dark:text-slate-100">{heading}</legend>
            <div className="flex flex-wrap gap-2">
              {reasons.map((reason, index) => (
                <button
                  key={reason}
                  ref={index === 0 ? firstFocusRef : undefined}
                  type="button"
                  aria-pressed={selectedReasons.includes(reason)}
                  onClick={() => toggleReason(reason)}
                  className={chipClass(selectedReasons.includes(reason))}
                >
                  {reason}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="feedback-details"
              className="mb-2 block text-sm font-bold text-slate-800 dark:text-slate-100"
            >
              Details <span className="font-medium text-slate-400 dark:text-slate-500">(optional)</span>
            </label>
            <textarea
              id="feedback-details"
              value={details}
              onChange={event => setDetails(event.target.value)}
              rows={3}
              placeholder="Share details (optional)"
              className="w-full resize-none rounded-2xl border border-slate-300 bg-white p-3.5 text-[15px] font-medium leading-relaxed text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-[var(--deepchat-accent)] focus:ring-2 focus:ring-[var(--deepchat-accent-soft)] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[var(--deepchat-accent-text)] dark:focus:ring-slate-800"
            />
          </div>

          <p className="text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            Your feedback is sent to the DeepChat server to help improve the platform.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 p-4 dark:border-slate-700/60 sm:p-5">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitState === 'saving'}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-slate-900 px-8 text-sm font-bold text-white transition-colors hover:bg-slate-700 active:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white dark:active:bg-slate-300"
          >
            {submitState === 'saving' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitState === 'saved' ? 'Saved' : 'Submit'}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
