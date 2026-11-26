'use client';

import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { X } from '@/components/ui/icons';
import type { AccountRole } from '@/lib/security/roles';
import type { AdminUserItem } from './types';

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
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!pending || !panelRef.current || !backdropRef.current) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.16, ease: 'power2.out' });
    gsap.fromTo(
      panelRef.current,
      { opacity: 0, scale: 0.96, y: 10 },
      { opacity: 1, scale: 1, y: 0, duration: 0.22, ease: 'power3.out' }
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
    update_role: `Change role`,
    update_plan: `Change plan`
  };

  const subtitleMap: Record<PendingAdminAction['kind'], string> = {
    ban: 'Active sessions will be revoked immediately and sign-in blocked.',
    unban: 'Restores account access.',
    delete: 'Permanently deletes this account and all associated data.',
    update_role:
      pending.kind === 'update_role'
        ? `${pending.user.email}: ${pending.user.role} → ${pending.nextRole}`
        : '',
    update_plan:
      pending.kind === 'update_plan'
        ? `${pending.user.email}: ${pending.user.plan} → ${pending.nextPlan}`
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
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-6 shadow-2xl"
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
            className="rounded-full p-1.5 text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--dc-text-muted)]">
              Reason (min {minReasonLen} chars) *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Reason for audit log..."
              className="w-full resize-none rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3.5 py-2.5 text-sm text-[var(--dc-text-strong)] outline-none transition-colors focus:border-[var(--deepchat-accent)]"
            />
          </div>

          {needsEmailConfirm && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--dc-text-muted)]">
                Type <span className="font-mono text-[var(--dc-text-strong)]">{pending.user.email}</span> to confirm
              </label>
              <input
                type="text"
                required
                value={confirmEmail}
                onChange={e => setConfirmEmail(e.target.value)}
                placeholder={pending.user.email}
                className="w-full rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3.5 py-2 text-sm text-[var(--dc-text-strong)] outline-none transition-colors focus:border-red-500"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-medium text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-40 ${
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
