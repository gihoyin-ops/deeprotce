'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogHeader } from '@/components/settings/dialog';
import { Loader2 } from '@/components/ui/icons';
import { LIKE_REASONS, type MessageRating } from '@/lib/feedback/message-feedback';

type SubmitState = 'idle' | 'saving' | 'saved';

interface FeedbackDialogProps {
  open: boolean;
  closing: boolean;
  messageKind: 'error' | 'normal';
  // Dislike reasons for this message kind (error list includes "Always Error Response").
  dislikeReasons: readonly string[];
  // Rating to pre-select when the sheet opens (always "dislike": the sheet is
  // opened from the thumbs-down action).
  presetRating: MessageRating;
  // Stored rating for this message, if any (enables "Remove feedback" and
  // restores a prior dislike annotation).
  storedRating: MessageRating | null;
  initialReasons: string[];
  initialDetails: string;
  initialPersisted: boolean;
  onClose: () => void;
  onSubmit: (rating: MessageRating, reasons: string[], details: string) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
}

// ChatGPT-style "Share feedback" sheet. The reason chips and wording change
// for error responses (the failure is the subject) versus normal answers.
export function FeedbackDialog({ open, closing, messageKind, dislikeReasons, presetRating, storedRating, initialReasons, initialDetails, initialPersisted, onClose, onSubmit, onRemove }: FeedbackDialogProps) {
  const [selected, setSelected] = useState<MessageRating>(presetRating);
  const [reasons, setReasons] = useState<string[]>(initialReasons);
  const [details, setDetails] = useState(initialDetails);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const hadPriorVote = storedRating !== null;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  // The dialog remounts for every message, so the state above is fresh each time
  // it opens; move focus to the first rating control once it is on screen.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => firstFocusRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const reasonsList = selected === 'like' ? LIKE_REASONS : dislikeReasons;
  const canSubmit = submitState !== 'saving';

  const toggleReason = (reason: string) => {
    setReasons(current => (current.includes(reason) ? current.filter(item => item !== reason) : [...current, reason]));
  };

  const handleRatingChange = (rating: MessageRating) => {
    // Switching direction clears the other list's selections and resets the
    // annotation (previously saved notes belong to the other direction).
    setSelected(rating);
    setReasons([]);
    setDetails('');
    setSubmitState('idle');
  };

  const handleSubmit = async () => {
    if (!selected || submitState === 'saving') return;
    setSubmitState('saving');
    const ok = await onSubmit(selected, reasons, details.trim());
    if (ok) {
      setSubmitState('saved');
      window.setTimeout(onClose, 650);
    } else {
      setSubmitState('idle');
    }
  };

  const handleRemove = async () => {
    if (submitState === 'saving') return;
    setSubmitState('saving');
    const ok = await onRemove();
    if (ok) {
      setSubmitState('saved');
      window.setTimeout(onClose, 450);
    } else {
      setSubmitState('idle');
    }
  };

  // Focus trap: Tab / Shift+Tab wrap within the dialog, Escape closes it.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !wrapperRef.current) return;
    const focusables = wrapperRef.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], textarea:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'
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

  const chipClass = (active: boolean) =>
    `min-h-[44px] rounded-full border px-4 py-2 text-left text-[13px] font-semibold leading-snug transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--deepchat-accent)] dark:focus-visible:outline-[var(--deepchat-accent-text)] sm:text-sm ${
      active
        ? 'border-[var(--deepchat-accent)] bg-[var(--deepchat-accent-soft)] text-[var(--deepchat-accent-text)] dark:border-[var(--deepchat-accent-text)] dark:bg-slate-950'
        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
    }`;

  const ratingButtonClass = (active: boolean) =>
    `min-h-[44px] flex-1 rounded-2xl border px-4 py-3 text-left text-sm font-bold leading-snug transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--deepchat-accent)] dark:focus-visible:outline-[var(--deepchat-accent-text)] ${
      active
        ? 'border-[var(--deepchat-accent)] bg-[var(--deepchat-accent-soft)] text-[var(--deepchat-accent-text)] dark:border-[var(--deepchat-accent-text)] dark:bg-slate-950'
        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
    }`;

  return (
    <div ref={wrapperRef} onKeyDown={handleKeyDown}>
      <Dialog open={open} closing={closing} zIndex={500} width="max-w-xl" onClose={onClose}>
        <DialogHeader
          title="Share feedback"
          description={messageKind === 'error' ? 'This response ran into a problem. Tell us what to look at.' : 'Tell us what was off so the assistant can do better.'}
          onClose={onClose}
        />
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:gap-5 sm:p-6">
          <fieldset className="m-0 border-0 p-0">
            <legend className="sr-only">Is this response good or bad?</legend>
            <div className="flex flex-col gap-2 sm:flex-row" role="group" aria-label="Rate this response">
              <button
                ref={firstFocusRef}
                type="button"
                aria-pressed={selected === 'like'}
                onClick={() => handleRatingChange('like')}
                className={ratingButtonClass(selected === 'like')}
              >
                {messageKind === 'error' ? 'Not an error: the answer was fine' : 'Helpful'}
              </button>
              <button
                type="button"
                aria-pressed={selected === 'dislike'}
                onClick={() => handleRatingChange('dislike')}
                className={ratingButtonClass(selected === 'dislike')}
              >
                {messageKind === 'error' ? 'Wrong or confusing error' : 'Not helpful'}
              </button>
            </div>
          </fieldset>

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 block text-sm font-bold text-slate-800 dark:text-slate-100">
              {selected === 'dislike'
                ? (messageKind === 'error' ? 'What happened?' : 'What went wrong?')
                : (messageKind === 'error' ? 'How well was it handled?' : 'Why does it work well?')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {reasonsList.map(reason => (
                <button
                  key={reason}
                  type="button"
                  aria-pressed={reasons.includes(reason)}
                  onClick={() => toggleReason(reason)}
                  className={chipClass(reasons.includes(reason))}
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
            Feedback is saved on this DeepChat instance{initialPersisted ? '' : ' (this device)'} to help improve responses.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 dark:border-slate-700/60 sm:p-5">
          <button
            type="button"
            onClick={() => void handleRemove()}
            disabled={!hadPriorVote || submitState === 'saving'}
            className="min-h-[44px] rounded-full px-4 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 dark:active:bg-slate-700"
          >
            Remove feedback
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
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
