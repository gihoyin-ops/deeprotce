'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Edit3, X } from '@/components/ui/icons';
import { PillDropdown } from '../PillDropdown';
import type { UserProfile } from '../types';

interface AccountTabProps {
  profile: UserProfile;
  isLoading: boolean;
  onUpdateProfile: (patch: Partial<UserProfile>) => Promise<void> | void;
  onDeleteAccount: () => Promise<void> | void;
  isDeletingAccount?: boolean;
}

const AGE_OPTIONS = [
  { label: '18 or older', value: '18 or older' },
  { label: 'Under 18', value: 'Under 18' },
  { label: 'Prefer not to say', value: 'Prefer not to say' }
];

type EditingField = 'name' | 'username' | null;

export function AccountTab({
  profile,
  isLoading,
  onUpdateProfile,
  onDeleteAccount,
  isDeletingAccount = false
}: AccountTabProps) {
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [draftValue, setDraftValue] = useState('');
  const [backendPlan, setBackendPlan] = useState<string | null>(null);
  const [isDeleteCardOpen, setIsDeleteCardOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/usage')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (active && data?.plan) {
          setBackendPlan(String(data.plan));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const startEdit = (field: EditingField, initial: string) => {
    setEditingField(field);
    setDraftValue(initial);
  };

  const cancelEdit = () => {
    setEditingField(null);
    setDraftValue('');
  };

  const commitEdit = async () => {
    if (!editingField) return;
    const trimmed = draftValue.trim();
    if (editingField === 'name') {
      if (!trimmed) return;
      await onUpdateProfile({ name: trimmed });
    } else if (editingField === 'username') {
      const normalized = trimmed.replace(/^@+/, '').replace(/\s+/g, '_').toLowerCase();
      await onUpdateProfile({ username: normalized });
    }
    setEditingField(null);
  };

  const displayPlan = backendPlan || profile.plan || 'Free';
  const displayUsername = profile.username ? `@${profile.username.replace(/^@+/, '')}` : 'Not set';
  const displayAge = profile.age || '18 or older';

  return (
    <div className="space-y-8">
      <header>
        <h3 className="text-2xl font-semibold tracking-tight text-[var(--dc-text-strong)]">Account</h3>
        <p className="mt-1 text-sm text-[var(--dc-text-muted)]">Review your account details</p>
      </header>

      <section>
        <h4 className="border-b border-[var(--dc-border-subtle)] pb-3 text-sm font-semibold text-[var(--dc-text-strong)]">
          Details
        </h4>

        <div className="divide-y divide-[var(--dc-border-subtle)]">
          {/* Name */}
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Name</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">The name associated with your account</p>
            </div>
            {editingField === 'name' ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draftValue}
                  onChange={event => setDraftValue(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') void commitEdit();
                    if (event.key === 'Escape') cancelEdit();
                  }}
                  autoFocus
                  className="h-9 w-48 rounded-full border border-[var(--dc-border-strong)] bg-[var(--dc-surface)] px-3.5 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
                  placeholder="Your name"
                />
                <button
                  type="button"
                  onClick={() => void commitEdit()}
                  aria-label="Save name"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--dc-invert)] text-[var(--dc-text-on-invert)] transition-opacity hover:opacity-90"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  aria-label="Cancel editing name"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm text-[var(--dc-text)]">
                  {isLoading ? 'Loading...' : profile.name || 'Guest'}
                </span>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => startEdit('name', profile.name || '')}
                  aria-label="Edit name"
                  className="rounded-full p-1.5 text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)] disabled:opacity-50"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Username */}
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Username</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Your unique handle on DeepChat</p>
            </div>
            {editingField === 'username' ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draftValue}
                  onChange={event => setDraftValue(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') void commitEdit();
                    if (event.key === 'Escape') cancelEdit();
                  }}
                  autoFocus
                  className="h-9 w-48 rounded-full border border-[var(--dc-border-strong)] bg-[var(--dc-surface)] px-3.5 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
                  placeholder="username"
                />
                <button
                  type="button"
                  onClick={() => void commitEdit()}
                  aria-label="Save username"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--dc-invert)] text-[var(--dc-text-on-invert)] transition-opacity hover:opacity-90"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  aria-label="Cancel editing username"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-3">
                <span className={`text-sm ${profile.username ? 'text-[var(--dc-text)]' : 'text-[var(--dc-text-muted)]'}`}>
                  {displayUsername}
                </span>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => startEdit('username', profile.username || '')}
                  aria-label="Edit username"
                  className="rounded-full p-1.5 text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)] disabled:opacity-50"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Plan */}
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Plan</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">The plan for your current workspace</p>
            </div>
            <span className="shrink-0 text-sm font-medium text-[var(--dc-text-strong)]">{displayPlan}</span>
          </div>

          {/* Age */}
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Age</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">The age range used to apply account protections</p>
            </div>
            <PillDropdown
              value={displayAge}
              options={AGE_OPTIONS}
              onChange={value => void onUpdateProfile({ age: value })}
              ariaLabel="Select age range"
            />
          </div>

          {/* Delete account */}
          <div className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--dc-text-strong)]">Delete account</p>
              <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Permanently delete your DeepChat account and all synced data</p>
            </div>
            <button
              type="button"
              onClick={() => setIsDeleteCardOpen(true)}
              className="shrink-0 rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
            >
              Delete account
            </button>
          </div>
        </div>
      </section>

      {/* Delete account confirmation card (portaled outside SettingsModal for full-screen focus) */}
      {isDeleteCardOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
          onClick={() => !isDeletingAccount && setIsDeleteCardOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="w-full max-w-[460px] rounded-3xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-6 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h3 id="delete-account-title" className="text-lg font-semibold text-[var(--dc-text-strong)]">
                Delete account—are you sure?
              </h3>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => setIsDeleteCardOpen(false)}
                aria-label="Close delete account dialog"
                className="rounded-full p-1 text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--dc-text-muted)]">
              <li>Deleting your account is permanent and cannot be undone</li>
              <li>Your profile, saved memories, and preferences will be permanently removed</li>
              <li>All synced conversations, library images, and attachments will be erased</li>
              <li>You will be signed out and this browser&apos;s session will be cleared immediately</li>
            </ul>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={() => setIsDeleteCardOpen(false)}
                className="rounded-full bg-[var(--dc-fill)] px-4 py-2 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill-hover)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingAccount}
                onClick={async () => {
                  await onDeleteAccount();
                  setIsDeleteCardOpen(false);
                }}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isDeletingAccount ? 'Deleting...' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
