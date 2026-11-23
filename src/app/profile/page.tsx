'use client';

import React, { useEffect, useRef, useState } from 'react';
import NextImage from 'next/image';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ArrowLeft, Check, Edit3, Plus, Settings as SettingsIcon } from '@/components/ui/icons';
import { getUserProfile, saveUserProfile } from '@/app/actions';
import { CropDialog } from '@/components/settings/panels/CropDialog';
import type { UserProfile } from '@/components/settings/types';

const FALLBACK_AVATAR = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix';

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile>({
    name: 'Guest',
    username: '',
    avatar: FALLBACK_AVATAR,
    plan: 'Free',
    age: '18 or older'
  });
  const [backendPlan, setBackendPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [isCropClosing, setIsCropClosing] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      getUserProfile(),
      fetch('/api/usage').then(r => (r.ok ? r.json() : null)).catch(() => null)
    ])
      .then(([saved, usage]) => {
        if (!active) return;
        setProfile({
          id: saved.id,
          name: saved.name || 'Guest',
          username: saved.username || '',
          avatar: saved.avatar || FALLBACK_AVATAR,
          plan: saved.plan || 'Free',
          age: saved.age || '18 or older'
        });
        if (usage?.plan) setBackendPlan(String(usage.plan));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = profile.name.trim();
    if (!trimmedName) {
      toast.error('Name cannot be empty');
      return;
    }
    setIsSaving(true);
    try {
      const normalizedUsername = (profile.username || '').trim().replace(/^@+/, '').replace(/\s+/g, '_').toLowerCase();
      const updated = await saveUserProfile({
        ...profile,
        name: trimmedName,
        username: normalizedUsername
      });
      setProfile(updated);
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to save profile');
    }
    setIsSaving(false);
  };

  const handleAvatarPicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCropImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleAvatarSaved = async (croppedDataUrl: string) => {
    const nextProfile = { ...profile, avatar: croppedDataUrl };
    setProfile(nextProfile);
    await saveUserProfile(nextProfile);
    setIsCropClosing(true);
    window.setTimeout(() => {
      setCropImage(null);
      setIsCropClosing(false);
    }, 180);
    toast.success('Avatar updated');
  };

  const displayPlan = backendPlan || profile.plan || 'Free';
  const initials = (profile.name || 'G')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'G';

  return (
    <div className="min-h-full w-full bg-[var(--dc-canvas)] text-[var(--dc-text)]">
      <div className="mx-auto max-w-3xl px-6 py-8 sm:py-12">
        {/* Top bar */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)] px-4 py-2 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-surface-hover)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Chat</span>
          </button>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('openSettings', { detail: { tab: 'account' } }))}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)] px-4 py-2 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-surface-hover)]"
          >
            <SettingsIcon className="h-4 w-4" />
            <span>Account Settings</span>
          </button>
        </div>

        {/* Profile header card */}
        <div className="rounded-3xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative shrink-0 self-start">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Change profile photo"
                className="group relative h-24 w-24 overflow-hidden rounded-full border-2 border-[var(--dc-border)] bg-[var(--dc-surface-muted)]"
              >
                {profile.avatar ? (
                  <NextImage
                    src={profile.avatar}
                    alt={profile.name || 'Profile avatar'}
                    width={96}
                    height={96}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-purple-600 text-2xl font-semibold text-white">
                    {initials}
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                  <Plus className="h-6 w-6 text-white" />
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarPicked}
                className="hidden"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="truncate text-2xl font-semibold text-[var(--dc-text-strong)]">
                  {isLoading ? 'Loading...' : profile.name || 'Guest'}
                </h1>
                <span className="rounded-full bg-[var(--dc-fill)] px-3 py-0.5 text-xs font-medium text-[var(--dc-text-strong)]">
                  {displayPlan}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--dc-text-muted)]">
                {profile.username ? `@${profile.username.replace(/^@+/, '')}` : 'No username set'}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)]"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Change avatar</span>
              </button>
            </div>
          </div>

          {/* Edit form */}
          <form onSubmit={handleSave} className="mt-8 space-y-5 border-t border-[var(--dc-border-subtle)] pt-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--dc-text-strong)]">
                  Name
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))}
                  disabled={isLoading}
                  placeholder="Your display name"
                  className="w-full rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-4 py-2.5 text-sm text-[var(--dc-text-strong)] outline-none transition-colors focus:border-[var(--deepchat-accent)]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--dc-text-strong)]">
                  Username
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[var(--dc-text-muted)]">
                    @
                  </span>
                  <input
                    type="text"
                    value={(profile.username || '').replace(/^@+/, '')}
                    onChange={e => setProfile(prev => ({ ...prev, username: e.target.value }))}
                    disabled={isLoading}
                    placeholder="username"
                    className="w-full rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] py-2.5 pl-8 pr-4 text-sm text-[var(--dc-text-strong)] outline-none transition-colors focus:border-[var(--deepchat-accent)]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--dc-text-strong)]">
                  Plan
                </label>
                <div className="rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface-muted)] px-4 py-2.5 text-sm text-[var(--dc-text)]">
                  {displayPlan}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--dc-text-strong)]">
                  Age range
                </label>
                <div className="rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface-muted)] px-4 py-2.5 text-sm text-[var(--dc-text)]">
                  {profile.age || '18 or older'}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isLoading || isSaving}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--dc-invert)] px-5 py-2.5 text-sm font-medium text-[var(--dc-text-on-invert)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                <span>{isSaving ? 'Saving...' : 'Save profile'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {cropImage && (
        <CropDialog
          key={cropImage}
          image={cropImage}
          closing={isCropClosing}
          onClose={() => {
            setIsCropClosing(true);
            window.setTimeout(() => {
              setCropImage(null);
              setIsCropClosing(false);
            }, 180);
          }}
          onSave={handleAvatarSaved}
        />
      )}
    </div>
  );
}
