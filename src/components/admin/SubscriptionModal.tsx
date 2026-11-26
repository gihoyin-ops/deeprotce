'use client';

import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import toast from 'react-hot-toast';
import { X } from '@/components/ui/icons';
import type { AdminUserItem } from './types';

type SubMode = 'extend_days' | 'shorten_days' | 'set_date' | 'lifetime' | 'revoke';

interface SubscriptionModalProps {
  user: AdminUserItem | null;
  onClose: () => void;
  onUpdated: () => void;
}

const formatExpiry = (validUntil?: string | null) => {
  if (!validUntil) return 'Lifetime / No expiry';
  const d = new Date(validUntil);
  if (Number.isNaN(d.getTime())) return validUntil;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(d);
};

export function SubscriptionModal({ user, onClose, onUpdated }: SubscriptionModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<SubMode>('extend_days');
  const [days, setDays] = useState('30');
  const [customDate, setCustomDate] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !panelRef.current) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    gsap.fromTo(
      panelRef.current,
      { opacity: 0, scale: 0.96, y: 8 },
      { opacity: 1, scale: 1, y: 0, duration: 0.2, ease: 'power3.out' }
    );
  }, [user]);

  if (!user) return null;

  const canSubmit =
    reason.trim().length >= 4 &&
    (mode === 'lifetime' ||
      mode === 'revoke' ||
      (mode === 'set_date' ? Boolean(customDate) : Number(days) > 0 && Number(days) <= 3650));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'update_subscription',
          mode,
          days: mode === 'extend_days' || mode === 'shorten_days' ? Number(days) : undefined,
          validUntil: mode === 'set_date' ? new Date(`${customDate}T23:59:59.000Z`).toISOString() : undefined,
          reason: reason.trim()
        })
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error || 'Failed to update subscription');
        return;
      }
      toast.success('Subscription updated');
      onUpdated();
      onClose();
    } catch {
      toast.error('Network error while updating subscription');
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
        <div className="flex items-start justify-between gap-3 border-b border-[var(--dc-border-subtle)] pb-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--dc-text-strong)]">
              Manage subscription
            </h3>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
              {user.displayName} · <span className="font-mono">{user.email}</span>
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

        <div className="mt-4 rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] px-3.5 py-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[var(--dc-text-muted)]">Current plan</span>
            <span className="font-medium capitalize text-[var(--dc-text-strong)]">
              {user.plan === 'cool' ? 'Cools' : user.plan}
              {user.subscription?.grantedBy ? ` (${user.subscription.grantedBy})` : ''}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[var(--dc-text-muted)]">Expires</span>
            <span className="font-medium text-[var(--dc-text-strong)]">
              {formatExpiry(user.subscription?.validUntil)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--dc-text-muted)]">
              Adjustment
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'extend_days', label: 'Extend (+ days)' },
                  { id: 'shorten_days', label: 'Shorten (- days)' },
                  { id: 'set_date', label: 'Set expiry date' },
                  { id: 'lifetime', label: 'Set lifetime' },
                  { id: 'revoke', label: 'Remove sub (→ Free)' }
                ] as const
              ).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMode(opt.id)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition-colors ${
                    mode === opt.id
                      ? opt.id === 'revoke'
                        ? 'border-red-500/40 bg-red-500/10 text-red-500'
                        : 'border-[var(--dc-text-strong)] bg-[var(--dc-fill)] text-[var(--dc-text-strong)]'
                      : 'border-[var(--dc-border)] bg-[var(--dc-surface)] text-[var(--dc-text-muted)] hover:text-[var(--dc-text-strong)]'
                  } ${opt.id === 'revoke' ? 'col-span-2' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {(mode === 'extend_days' || mode === 'shorten_days') && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--dc-text-muted)]">
                Days
              </label>
              <div className="flex items-center gap-2">
                {['7', '14', '30', '90'].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDays(preset)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                      days === preset
                        ? 'border-[var(--dc-text-strong)] bg-[var(--dc-fill)] text-[var(--dc-text-strong)]'
                        : 'border-[var(--dc-border)] text-[var(--dc-text-muted)]'
                    }`}
                  >
                    {mode === 'extend_days' ? `+${preset}d` : `-${preset}d`}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={days}
                  onChange={e => setDays(e.target.value)}
                  className="ml-auto w-20 rounded-lg border border-[var(--dc-border)] bg-[var(--dc-surface)] px-2.5 py-1 text-xs text-[var(--dc-text-strong)] outline-none"
                />
              </div>
            </div>
          )}

          {mode === 'set_date' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--dc-text-muted)]">
                Expiration date
              </label>
              <input
                type="date"
                required
                value={customDate}
                onChange={e => setCustomDate(e.target.value)}
                className="w-full rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3 py-2 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--dc-text-muted)]">
              Reason (logged in audit trail) *
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Extended Cools sub for 30 days"
              className="w-full rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3 py-2 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
            />
          </div>

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
                mode === 'revoke'
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-[var(--dc-invert)] text-[var(--dc-text-on-invert)] hover:opacity-90'
              }`}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
