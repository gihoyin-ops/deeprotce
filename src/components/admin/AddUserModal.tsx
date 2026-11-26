'use client';

import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import toast from 'react-hot-toast';
import { Plus, RefreshCw, X } from '@/components/ui/icons';
import PasswordToggleButton from '@/components/ui/PasswordToggleButton';
import { convertImageToWebp } from '@/lib/images/client-webp';
import { buildDefaultAvatarUrl } from '@/lib/avatar';
import type { AccountRole } from '@/lib/security/roles';
import type { AdminPlanChoice } from './types';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const generateRandomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  const arr = new Uint32Array(14);
  crypto.getRandomValues(arr);
  for (let i = 0; i < arr.length; i++) {
    out += chars[arr[i] % chars.length];
  }
  return out;
};

export function AddUserModal({ isOpen, onClose, onCreated }: AddUserModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [plan, setPlan] = useState<AdminPlanChoice>('free');
  const [role, setRole] = useState<AccountRole>('user');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);

  useEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    gsap.fromTo(
      panelRef.current,
      { opacity: 0, scale: 0.96, y: 10 },
      { opacity: 1, scale: 1, y: 0, duration: 0.22, ease: 'power3.out' }
    );
  }, [isOpen]);

  if (!isOpen) return null;

  const previewAvatar =
    avatarUrl.trim() || buildDefaultAvatarUrl(username.trim() || email.trim() || 'new-user');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingAvatar(true);
    try {
      const { file: webpFile } = await convertImageToWebp(file, {
        maxDimension: 256,
        quality: 0.85
      });
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(webpFile);
      });
      setAvatarUrl(dataUrl);
    } catch {
      toast.error('Could not process profile photo');
    } finally {
      setIsProcessingAvatar(false);
      e.target.value = '';
    }
  };

  const resetForm = () => {
    setEmail('');
    setUsername('');
    setDisplayName('');
    setPassword('');
    setPlan('free');
    setRole('user');
    setAvatarUrl('');
    setReason('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !username.trim() || password.length < 8) {
      toast.error('Email, username, and password (min 8 chars) are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: email.trim(),
          username: username.trim(),
          displayName: displayName.trim() || undefined,
          password,
          avatarUrl: avatarUrl.trim() || undefined,
          plan,
          role,
          reason: reason.trim() || undefined
        })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'Failed to create user');
        return;
      }
      toast.success(`Created ${role === 'user' ? 'user' : role.replace('_', ' ')} account`);
      resetForm();
      onCreated();
      onClose();
    } catch {
      toast.error('Network error while creating user');
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
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--dc-border-subtle)] pb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-[var(--dc-text-strong)]">
              Add account
            </h2>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
              Create a new user or staff member with a specific plan and role.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Profile photo */}
          <div className="flex items-center gap-4">
            <img
              src={previewAvatar}
              alt="Avatar preview"
              className="h-14 w-14 shrink-0 rounded-full border border-[var(--dc-border)] object-cover"
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isProcessingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3 py-1.5 text-xs font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-surface-hover)] disabled:opacity-50"
                >
                  {isProcessingAvatar ? 'Processing...' : 'Upload photo'}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl('')}
                    className="text-xs text-[var(--dc-text-muted)] hover:text-[var(--dc-text-strong)]"
                  >
                    Reset
                  </button>
                )}
              </div>
              <input
                type="url"
                value={avatarUrl.startsWith('data:') ? '' : avatarUrl}
                onChange={e => setAvatarUrl(e.target.value)}
                placeholder="Or paste https:// image URL"
                className="w-full rounded-lg border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] px-2.5 py-1.5 text-xs text-[var(--dc-text)] outline-none focus:border-[var(--deepchat-accent)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--dc-text-muted)]">
                Email *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3 py-2 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--dc-text-muted)]">
                Username *
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="username"
                className="w-full rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3 py-2 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--dc-text-muted)]">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Optional (defaults to username)"
              className="w-full rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3 py-2 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--dc-text-muted)]">
                Password * (min 8 chars)
              </label>
              <button
                type="button"
                onClick={() => {
                  setPassword(generateRandomPassword());
                  setShowPassword(true);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--dc-text-muted)] hover:text-[var(--dc-text-strong)]"
              >
                <RefreshCw className="h-3 w-3" />
                Generate
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)] py-2 pl-3 pr-10 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <PasswordToggleButton
                  visible={showPassword}
                  onToggle={() => setShowPassword(v => !v)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--dc-text-muted)]">
                Plan
              </label>
              <select
                value={plan}
                onChange={e => setPlan(e.target.value as AdminPlanChoice)}
                className="w-full rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3 py-2 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
              >
                <option value="free">Free</option>
                <option value="supporters">Supporters</option>
                <option value="cool">Cools</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--dc-text-muted)]">
                Role
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as AccountRole)}
                className="w-full rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3 py-2 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
              >
                <option value="user">User</option>
                <option value="staff">Staff</option>
                <option value="manager_staff">Manager Staff</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--dc-text-muted)]">
              Audit note (optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Onboarding new support staff"
              className="w-full rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3 py-2 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--dc-border-subtle)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--dc-invert)] px-4 py-2 text-sm font-medium text-[var(--dc-text-on-invert)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {isSubmitting ? 'Creating...' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
