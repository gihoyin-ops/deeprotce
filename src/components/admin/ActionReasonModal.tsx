'use client';

import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { X } from '@/components/ui/icons';
import type { AdminUserItem } from './types';
import type { AccountRole } from '@/lib/security/roles';

export type PendingAdminAction =
  | { kind: 'ban'; user: AdminUserItem }
  | { kind: 'unban'; user: AdminUserItem }
  | { kind: 'delete'; user: AdminUserItem }
  | { kind: 'update_role'; user: AdminUserItem; nextRole: AccountRole }
  | { kind: 'update_plan'; user: AdminUserItem; nextPlan: 'free' | 'supporters' | 'cool' };

interface ActionReasonModalProps {
  pending: PendingAdminAction | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function ActionReasonModal({ pending, onClose, onConfirm }: ActionReasonModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!pending || !panelRef.current) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    gsap.fromTo(
      panelRef.current,
      { opacity: 0, scale: 0.96, y: 8 },
      { opacity: 1, scale: 1, y: 0, duration: 0.2, ease: 'power3.out' }
    );
  }, [pending]);

  if (!pending) return null;

  const isDanger = pending.kind === 'ban' || pending.kind === 'delete';
  const minReasonLen = isDanger ? 5 : 4;
  const needsEmailConfirm = pending.kind === 'delete';
  const canSubmit =
    reason.trim().length >= minReasonLen &&
    (!needsEmailConfirm || confirmEmail.trim().toLowerCase() === pending.user.email.toLowerCase());

  const titleMap: Record<PendingAdminAction['kind'], string> = {
    ban: `Ban ${pending.user.displayName}`,
    unban: `Unban ${pending.user.displayName}`,
    delete: `Delete ${pending.user.displayName}`,
    update_role: `Change role for ${pending.user.displayName}`,
    update_plan: `Change plan for ${pending.user.displayName}`
  };

  const subtitleMap: Record<PendingAdminAction['kind'], string> = {
    ban: 'All active sessions will be revoked immediately and sign-in will be blocked.',
    unban: 'Restores account access so the user can sign in again.',
    delete: 'Permanently deletes the account, chats, and stored assets. This cannot be undone.',
    update_role:
      pending.kind === 'update_role'
        ? `Update role from ${pending.user.role} to ${pending.nextRole}.`
        : '',
    update_plan:
      pending.kind === 'update_plan'
        ? `Update plan from ${pending.user.plan} to ${pending.nextPlan}.`
        : ''
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--dc-text-strong)]">
              {titleMap[pending.kind]}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--dc-text-muted)]">
              {subtitleMap[pending.kind]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--dc-text-muted)]">
              Reason (logged in audit trail, min {minReasonLen} chars) *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Explain why this action is being taken..."
              className="w-full resize-none rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3 py-2 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
            />
          </div>

          {needsEmailConfirm && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--dc-text-muted)]">
                Type <span className="font-mono text-[var(--dc-text-strong)]">{pending.user.email}</span> to confirm
              </label>
              <input
                type="text"
                required
                value={confirmEmail}
                onChange={e => setConfirmEmail(e.target.value)}
                placeholder={pending.user.email}
                className="w-full rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3 py-2 text-sm text-[var(--dc-text-strong)] outline-none focus:border-red-500"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3.5 py-2 text-sm font-medium text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40 ${
                isDanger
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-[var(--dc-invert)] text-[var(--dc-text-on-invert)] hover:opacity-90'
              }`}
            >
              {isSubmitting ? 'Applying...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
