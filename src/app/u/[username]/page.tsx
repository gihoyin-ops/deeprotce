'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { gsap } from 'gsap';
import toast from 'react-hot-toast';
import {
  buildDefaultAvatarUrl,
  DEFAULT_GUEST_AVATAR,
  normalizeUsername
} from '@/lib/avatar';
import { AUTH_SESSION_QUERY_KEY } from '@/lib/auth/guest';
import { deepchatQueryKeys } from '@/lib/query-keys';
import { saveUserProfileClient } from '@/lib/storage/client-storage';
import { convertImageToWebp } from '@/lib/images/client-webp';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import { CropDialog } from '@/components/settings/panels/CropDialog';
import { Check, Edit3, Globe, Loader2, Share2, X } from '@/components/ui/icons';

interface DailyPoint {
  day: string;
  tokens: number;
}

interface ModelStat {
  modelId: string;
  tokens: number;
  requests: number;
}

interface ProfileResponse {
  ok?: boolean;
  found?: boolean;
  private?: boolean;
  isOwner?: boolean;
  error?: string;
  profile?: {
    id: string;
    name: string;
    username: string;
    avatar: string;
    plan: string;
    isPublic: boolean;
  };
  stats?: {
    lifetimeTokens: number;
    peakTokens: number;
    longestStreak: number;
    currentStreak: number;
    dailyActivity: DailyPoint[];
    mostUsedModels: ModelStat[];
  };
}

function LockIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

const formatTokens = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(value));
};

const formatDays = (days: number): string => `${days} ${days === 1 ? 'day' : 'days'}`;

const formatPlanLabel = (plan?: string): string => {
  const clean = (plan || 'free').trim();
  if (!clean) return 'Free';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};

export default function UserProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const rawUsername = decodeURIComponent(params?.username || '');

  const pageRef = useRef<HTMLDivElement | null>(null);
  const editCardRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [data, setData] = useState<ProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftUsername, setDraftUsername] = useState('');
  const [draftAvatar, setDraftAvatar] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingPrivacy, setIsTogglingPrivacy] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<DailyPoint | null>(null);

  const loadProfile = useCallback(async () => {
    if (!rawUsername) return;
    setIsLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/u/${encodeURIComponent(rawUsername)}`, {
        credentials: 'same-origin'
      });
      if (res.status === 404) {
        setNotFound(true);
        setData(null);
        return;
      }
      const json = (await res.json()) as ProfileResponse;
      if (!res.ok || !json.profile) {
        setNotFound(true);
        setData(null);
        return;
      }
      setData(json);
      setDraftName(json.profile.name);
      setDraftUsername(json.profile.username);
      setDraftAvatar(json.profile.avatar);
    } catch {
      toast.error('Could not load profile.');
    } finally {
      setIsLoading(false);
    }
  }, [rawUsername]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (data?.profile) {
      document.title = `${data.profile.name} (@${data.profile.username}) / DeepChat`;
    }
  }, [data?.profile?.name, data?.profile?.username]);

  useEffect(() => {
    const el = pageRef.current;
    if (isLoading || !data || !el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelectorAll('[data-up-stagger]'),
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.42,
          stagger: 0.055,
          ease: 'power3.out',
          clearProps: 'transform'
        }
      );
    }, pageRef);
    return () => ctx.revert();
  }, [isLoading, data?.profile?.id]);

  useEffect(() => {
    const el = editCardRef.current;
    if (!isEditing || !el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, scale: 0.95, y: 12 },
        { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'expo.out', clearProps: 'transform' }
      );
    }, editCardRef);
    return () => ctx.revert();
  }, [isEditing]);

  const handleTogglePrivacy = async () => {
    if (!data?.profile || !data.isOwner || isTogglingPrivacy) return;
    const nextPublic = !data.profile.isPublic;
    setIsTogglingPrivacy(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ isPublic: nextPublic })
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error || 'Failed to update privacy setting.');
        return;
      }
      setData(prev =>
        prev?.profile
          ? { ...prev, profile: { ...prev.profile, isPublic: nextPublic } }
          : prev
      );
      toast.success(nextPublic ? 'Profile is now public' : 'Profile is now private');
    } catch {
      toast.error('Network error while updating privacy.');
    } finally {
      setIsTogglingPrivacy(false);
    }
  };

  const handleShare = async () => {
    if (!data?.profile) return;
    const shareUrl = `${window.location.origin}/u/${encodeURIComponent(data.profile.username)}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `${data.profile.name} (@${data.profile.username}) · DeepChat`,
          url: shareUrl
        });
        return;
      }
    } catch {
      // User cancelled native share or unsupported; fall back to clipboard
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(
        data.profile.isPublic
          ? 'Profile link copied'
          : 'Link copied (switch to Public so others can view it)'
      );
    } catch {
      toast.error('Unable to copy link.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setCropSrc(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.profile || !data.isOwner || isSaving) return;

    const cleanName = draftName.trim();
    const cleanUsername = normalizeUsername(draftUsername);
    if (!cleanName) {
      toast.error('Name cannot be empty.');
      return;
    }
    if (cleanUsername.length < 3) {
      toast.error('Username must be at least 3 characters.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          displayName: cleanName,
          username: cleanUsername,
          avatarUrl: draftAvatar || buildDefaultAvatarUrl(cleanUsername)
        })
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        account?: {
          id: string;
          displayName: string;
          username: string;
          avatarUrl: string;
          plan: string;
        };
      };

      if (!res.ok || !json.account) {
        toast.error(json.error || 'Could not update profile.');
        return;
      }

      const acc = json.account;
      const updatedProfile = {
        id: acc.id,
        name: acc.displayName,
        username: acc.username,
        avatar: acc.avatarUrl,
        plan: acc.plan,
        age: '18 or older'
      };
      await saveUserProfileClient(updatedProfile, { skipRemoteSync: true });
      queryClient.setQueryData(deepchatQueryKeys.profile, updatedProfile);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.profile })
      ]);

      setIsEditing(false);
      toast.success('Profile updated');

      if (acc.username.toLowerCase() !== rawUsername.toLowerCase()) {
        router.replace(`/u/${encodeURIComponent(acc.username)}`);
      } else {
        setData(prev =>
          prev?.profile
            ? {
                ...prev,
                profile: {
                  ...prev.profile,
                  name: acc.displayName,
                  username: acc.username,
                  avatar: acc.avatarUrl,
                  plan: acc.plan
                }
              }
            : prev
        );
      }
    } catch {
      toast.error('Network error while saving profile.');
    } finally {
      setIsSaving(false);
    }
  };

  // Group dailyActivity into 26 columns (weeks) of 7 days for GitHub-style heatmap
  const activityWeeks = useMemo(() => {
    const points = data?.stats?.dailyActivity ?? [];
    if (points.length === 0) return [];
    const maxTokens = points.reduce((acc, p) => Math.max(acc, p.tokens), 0);
    const weeks: Array<Array<DailyPoint & { level: 0 | 1 | 2 | 3 | 4 }>> = [];
    for (let i = 0; i < points.length; i += 7) {
      const slice = points.slice(i, i + 7).map(pt => {
        if (pt.tokens <= 0 || maxTokens <= 0) return { ...pt, level: 0 as const };
        const ratio = pt.tokens / maxTokens;
        const level: 1 | 2 | 3 | 4 =
          ratio > 0.75 ? 4 : ratio > 0.45 ? 3 : ratio > 0.2 ? 2 : 1;
        return { ...pt, level };
      });
      weeks.push(slice);
    }
    return weeks;
  }, [data?.stats?.dailyActivity]);

  const maxModelTokens = useMemo(() => {
    const models = data?.stats?.mostUsedModels ?? [];
    return models.reduce((acc, m) => Math.max(acc, m.tokens), 0) || 1;
  }, [data?.stats?.mostUsedModels]);

  if (isLoading) {
    return (
      <div className="custom-scrollbar h-full w-full overflow-y-auto bg-[var(--dc-canvas)] text-[var(--dc-text)]">
        <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-12">
          <div className="flex flex-col items-center gap-4 pt-6">
            <div className="h-24 w-24 animate-pulse rounded-full bg-[var(--dc-surface)] border border-[var(--dc-border-subtle)]" />
            <div className="h-6 w-40 animate-pulse rounded-lg bg-[var(--dc-surface)]" />
            <div className="h-4 w-24 animate-pulse rounded-lg bg-[var(--dc-surface)]" />
            <div className="mt-4 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map(idx => (
                <div
                  key={idx}
                  className="h-20 animate-pulse rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)]"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !data?.profile) {
    return (
      <div className="custom-scrollbar flex h-full w-full items-center justify-center overflow-y-auto bg-[var(--dc-canvas)] px-6 text-[var(--dc-text)]">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold text-[var(--dc-text-strong)]">Profile not found</h1>
          <p className="mt-2 text-sm text-[var(--dc-text-muted)]">
            The user @{rawUsername || 'unknown'} does not exist or has not set up a handle yet.
          </p>
        </div>
      </div>
    );
  }

  const { profile, isOwner, stats } = data;
  const isPrivateLocked = Boolean(data.private && !isOwner);

  return (
    <div className="custom-scrollbar h-full w-full overflow-y-auto bg-[var(--dc-canvas)] text-[var(--dc-text)]">
      <div ref={pageRef} className="mx-auto max-w-3xl px-4 pb-16 pt-[64px] sm:px-8 sm:pt-8">
        {/* Top utility bar: Edit, Private/Public, Share */}
        <div data-up-stagger className="mb-6 flex items-center justify-end gap-1.5 sm:mb-4">
          {isOwner && (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(prev => !prev)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface)] hover:text-[var(--dc-text-strong)] active:scale-[0.98]"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>{isEditing ? 'Close' : 'Edit'}</span>
              </button>

              <button
                type="button"
                onClick={handleTogglePrivacy}
                disabled={isTogglingPrivacy}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface)] hover:text-[var(--dc-text-strong)] active:scale-[0.98] disabled:opacity-60"
              >
                {profile.isPublic ? (
                  <>
                    <Globe className="h-3.5 w-3.5 text-[var(--dc-text-strong)]" />
                    <span className="text-[var(--dc-text-strong)]">Public</span>
                  </>
                ) : (
                  <>
                    <LockIcon className="h-3.5 w-3.5" />
                    <span>Private</span>
                  </>
                )}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface)] hover:text-[var(--dc-text-strong)] active:scale-[0.98]"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share</span>
          </button>
        </div>

        {/* Instagram-style centered identity header */}
        <header data-up-stagger className="flex flex-col items-center text-center">
          <div className="relative h-24 w-24 sm:h-[104px] sm:w-[104px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={isEditing ? draftAvatar || DEFAULT_GUEST_AVATAR : profile.avatar || DEFAULT_GUEST_AVATAR}
              alt={profile.name}
              loading="lazy"
              className="h-full w-full rounded-full border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] object-cover"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--dc-text-strong)]">
              {profile.name}
            </h1>
            <span className="inline-flex items-center rounded-full border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--dc-text-muted)]">
              {formatPlanLabel(profile.plan)}
            </span>
          </div>

          <p className="mt-1 text-sm text-[var(--dc-text-muted)]">@{profile.username}</p>
        </header>

        {/* Instagram-style Centered Edit Profile Modal (Owner only) */}
        {isOwner && isEditing && typeof document !== 'undefined' && createPortal(
          <div
            onClick={() => setIsEditing(false)}
            className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
          >
            <form
              ref={editCardRef}
              onClick={e => e.stopPropagation()}
              onSubmit={handleSaveEdit}
              className="w-full max-w-sm rounded-3xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-base font-semibold text-[var(--dc-text-strong)]">Edit profile</h2>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  aria-label="Close editor"
                  className="rounded-full p-1 text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Tap photo directly to change photo (Instagram style, no shuffle) */}
              <div className="mb-5 flex flex-col items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative h-20 w-20 overflow-hidden rounded-full border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] focus:outline-none"
                  aria-label="Change profile photo"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={draftAvatar || DEFAULT_GUEST_AVATAR}
                    alt={draftName || profile.name}
                    className="h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-75"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-[11px] font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    Change
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 text-xs font-medium text-[var(--deepchat-accent)] hover:underline"
                >
                  Change profile photo
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--dc-text-muted)]">
                    Name
                  </label>
                  <input
                    type="text"
                    maxLength={64}
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] px-3.5 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--dc-border-strong)]"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--dc-text-muted)]">
                    Username
                  </label>
                  <div className="flex h-11 items-center rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] px-3.5 focus-within:border-[var(--dc-border-strong)]">
                    <span className="text-sm text-[var(--dc-text-muted)]">@</span>
                    <input
                      type="text"
                      maxLength={32}
                      value={draftUsername}
                      onChange={e => setDraftUsername(normalizeUsername(e.target.value))}
                      className="min-w-0 flex-1 bg-transparent pl-1 text-sm text-[var(--dc-text-strong)] outline-none"
                      placeholder="username"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="h-9 rounded-full px-4 text-xs font-medium text-[var(--dc-text-muted)] hover:text-[var(--dc-text-strong)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--dc-invert)] px-4 text-xs font-medium text-[var(--dc-text-on-invert)] transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>,
          document.body
        )}

        {/* Private State */}
        {isPrivateLocked ? (
          <section
            data-up-stagger
            className="mt-10 rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] px-6 py-12 text-center"
          >
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[var(--dc-border-subtle)] bg-[var(--dc-canvas)] text-[var(--dc-text-muted)]">
              <LockIcon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-[var(--dc-text-strong)]">
              This profile is private
            </h2>
            <p className="mt-1 text-sm text-[var(--dc-text-muted)]">
              Activity, streaks, and model usage are only visible to the account owner.
            </p>
          </section>
        ) : (
          <>
            {/* 4-Column Stats Bar */}
            <section
              data-up-stagger
              className="mt-8 grid grid-cols-2 divide-y divide-[var(--dc-border-subtle)] overflow-hidden rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] sm:grid-cols-4 sm:divide-x sm:divide-y-0"
            >
              <div className="px-4 py-4 text-center">
                <p className="text-lg font-semibold tracking-tight text-[var(--dc-text-strong)]">
                  {formatTokens(stats?.lifetimeTokens ?? 0)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Lifetime tokens</p>
              </div>
              <div className="border-l border-[var(--dc-border-subtle)] px-4 py-4 text-center sm:border-l-0">
                <p className="text-lg font-semibold tracking-tight text-[var(--dc-text-strong)]">
                  {formatTokens(stats?.peakTokens ?? 0)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Peak tokens</p>
              </div>
              <div className="px-4 py-4 text-center">
                <p className="text-lg font-semibold tracking-tight text-[var(--dc-text-strong)]">
                  {formatDays(stats?.longestStreak ?? 0)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Longest streak</p>
              </div>
              <div className="border-l border-[var(--dc-border-subtle)] px-4 py-4 text-center sm:border-l-0">
                <p className="text-lg font-semibold tracking-tight text-[var(--dc-text-strong)]">
                  {formatDays(stats?.currentStreak ?? 0)}
                </p>
                <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">Current streak</p>
              </div>
            </section>

            {/* GitHub-style Token Activity Heatmap */}
            <section
              data-up-stagger
              className="mt-6 rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] p-5"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-[var(--dc-text-strong)]">Token activity</h2>
                <span className="text-xs text-[var(--dc-text-muted)]">
                  {hoveredDay
                    ? `${hoveredDay.day} · ${formatTokens(hoveredDay.tokens)} tokens`
                    : 'Last 6 months'}
                </span>
              </div>

              <div className="custom-scrollbar overflow-x-auto pb-1 sm:overflow-visible">
                <div
                  className="inline-flex gap-[3px] sm:grid sm:w-full sm:gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, activityWeeks.length)}, minmax(0, 1fr))`
                  }}
                >
                  {activityWeeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-[3px] sm:gap-1">
                      {week.map(pt => {
                        const levelClass =
                          pt.level === 4
                            ? 'bg-[var(--deepchat-accent)]'
                            : pt.level === 3
                              ? 'bg-[var(--deepchat-accent)]/75'
                              : pt.level === 2
                                ? 'bg-[var(--deepchat-accent)]/45'
                                : pt.level === 1
                                  ? 'bg-[var(--deepchat-accent)]/20'
                                  : 'bg-[var(--dc-canvas)] border border-[var(--dc-border-subtle)]/70';
                        return (
                          <button
                            key={pt.day}
                            type="button"
                            onMouseEnter={() => setHoveredDay(pt)}
                            onFocus={() => setHoveredDay(pt)}
                            onMouseLeave={() => setHoveredDay(null)}
                            aria-label={`${pt.day}: ${pt.tokens} tokens`}
                            className={`h-[11px] w-[11px] rounded-[2.5px] transition-transform duration-150 hover:scale-125 sm:aspect-square sm:h-auto sm:w-full sm:rounded-[3px] ${levelClass}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-[var(--dc-text-muted)]">
                <span>Less</span>
                <span className="h-2.5 w-2.5 rounded-[2px] border border-[var(--dc-border-subtle)]/70 bg-[var(--dc-canvas)]" />
                <span className="h-2.5 w-2.5 rounded-[2px] bg-[var(--deepchat-accent)]/20" />
                <span className="h-2.5 w-2.5 rounded-[2px] bg-[var(--deepchat-accent)]/45" />
                <span className="h-2.5 w-2.5 rounded-[2px] bg-[var(--deepchat-accent)]/75" />
                <span className="h-2.5 w-2.5 rounded-[2px] bg-[var(--deepchat-accent)]" />
                <span>More</span>
              </div>
            </section>

            {/* Plan Section */}
            <section
              data-up-stagger
              className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] px-5 py-4"
            >
              <div>
                <p className="text-xs text-[var(--dc-text-muted)]">Current plan</p>
                <p className="mt-0.5 text-sm font-semibold text-[var(--dc-text-strong)]">
                  {formatPlanLabel(profile.plan)}
                </p>
              </div>
              {isOwner && (profile.plan || '').trim().toLowerCase() !== 'staff' && (
                <Link
                  href="/pricing"
                  className="rounded-full border border-[var(--dc-border-subtle)] bg-[var(--dc-canvas)] px-3.5 py-1.5 text-xs font-medium text-[var(--dc-text-strong)] transition-colors hover:border-[var(--dc-border-strong)]"
                >
                  View plans
                </Link>
              )}
            </section>

            {/* Most Used Models (Bottom) */}
            <section
              data-up-stagger
              className="mt-6 rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] p-5"
            >
              <h2 className="mb-4 text-sm font-semibold text-[var(--dc-text-strong)]">
                Most used models
              </h2>

              {!stats?.mostUsedModels || stats.mostUsedModels.length === 0 ? (
                <p className="py-4 text-center text-xs text-[var(--dc-text-muted)]">
                  No model usage recorded yet.
                </p>
              ) : (
                <div className="space-y-3.5">
                  {stats.mostUsedModels.map(model => {
                    const pct = Math.max(4, Math.round((model.tokens / maxModelTokens) * 100));
                    return (
                      <div key={model.modelId}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                          <span className="truncate font-medium text-[var(--dc-text-strong)]">
                            {model.modelId}
                          </span>
                          <span className="shrink-0 text-[var(--dc-text-muted)]">
                            {formatTokens(model.tokens)} tokens · {model.requests}{' '}
                            {model.requests === 1 ? 'chat' : 'chats'}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--dc-canvas)]">
                          <div
                            className="h-full rounded-full bg-[var(--deepchat-accent)] transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {cropSrc && (
        <CropDialog
          image={cropSrc}
          closing={false}
          onClose={() => setCropSrc(null)}
          onSave={async (croppedUrl: string) => {
            setCropSrc(null);
            try {
              const { file } = await convertImageToWebp(croppedUrl, {
                fileName: `${draftUsername || data?.profile?.username || 'avatar'}.webp`,
                quality: 0.9,
                maxDimension: 512
              });
              const form = new FormData();
              form.append('file', file);
              form.append('folder', 'profile');
              const uploadRes = await fetch('/api/storage/upload', {
                method: 'POST',
                credentials: 'same-origin',
                body: form
              });
              if (uploadRes.ok) {
                const uploaded = (await uploadRes.json()) as { url?: string };
                if (uploaded.url) {
                  setDraftAvatar(uploaded.url);
                  return;
                }
              }
            } catch {
              // Fallback to cropped data URL if R2 is not configured
            }
            setDraftAvatar(croppedUrl);
          }}
        />
      )}
    </div>
  );
}
