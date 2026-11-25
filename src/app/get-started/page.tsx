'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { gsap } from 'gsap';
import toast from 'react-hot-toast';
import {
  buildDefaultAvatarUrl,
  generateRandomUsername,
  isLegacyDefaultAvatar,
  normalizeUsername
} from '@/lib/avatar';
import { AUTH_SESSION_QUERY_KEY } from '@/lib/auth/guest';
import { deepchatQueryKeys } from '@/lib/query-keys';
import { getUserProfileClient, saveUserProfileClient } from '@/lib/storage/client-storage';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import { ArrowRight, Loader2, RefreshCw } from '@/components/ui/icons';

interface MeResponse {
  authenticated?: boolean;
  account?: {
    id: string;
    email: string;
    displayName: string;
    username?: string | null;
    avatarUrl?: string;
    plan?: string;
  };
}

export default function GetStartedPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const avatarWrapRef = useRef<HTMLDivElement | null>(null);
  const avatarShuffleIconRef = useRef<HTMLSpanElement | null>(null);
  const usernameShuffleIconRef = useRef<HTMLSpanElement | null>(null);
  const nameGroupRef = useRef<HTMLDivElement | null>(null);
  const usernameGroupRef = useRef<HTMLDivElement | null>(null);
  const usernameInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);
  const [accountId, setAccountId] = useState<string>('default');
  const [accountPlan, setAccountPlan] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const avatarUrl = buildDefaultAvatarUrl(avatarSeed);

  // Hydrate initial account state (if signed in) without blocking the UI
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        const data = res.ok ? ((await res.json()) as MeResponse) : null;
        if (!active) return;

        if (data?.authenticated && data.account) {
          const acc = data.account;
          setIsAuthenticated(true);
          setAccountId(acc.id);
          setAccountPlan(acc.plan || 'free');

          const emailLocalPart = acc.email.split('@')[0]?.toLowerCase() || '';
          const hasCustomName =
            acc.displayName &&
            acc.displayName.toLowerCase() !== emailLocalPart &&
            acc.displayName !== 'Guest';

          if (hasCustomName) {
            setName(acc.displayName);
          }

          if (acc.username) {
            setUsername(acc.username);
            setAvatarSeed(acc.username);
          } else {
            const generated = generateRandomUsername();
            setUsername(generated);
            setAvatarSeed(generated);
          }
          setIsHydrated(true);
          return;
        }
      } catch {
        // Fall back to local profile if offline
      }

      const local = await getUserProfileClient();
      if (!active) return;
      if (local.name && local.name !== 'Guest') {
        setName(local.name);
      }
      const nextUsername = local.username || generateRandomUsername();
      setUsername(nextUsername);
      if (local.avatar && !isLegacyDefaultAvatar(local.avatar)) {
        setAvatarSeed(local.username || local.name || 'deepchat-user');
      } else {
        setAvatarSeed(nextUsername);
      }
      setIsHydrated(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  // Smooth GSAP entrance choreography
  useEffect(() => {
    const el = containerRef.current;
    if (!el || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelectorAll('[data-gs-stagger]'),
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: 0.55,
          stagger: 0.075,
          ease: 'power3.out',
          clearProps: 'transform'
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const animateAvatarPop = () => {
    if (!avatarWrapRef.current || prefersReducedMotion()) return;
    gsap.fromTo(
      avatarWrapRef.current,
      { scale: 0.9 },
      { scale: 1, duration: 0.38, ease: 'back.out(1.8)', clearProps: 'transform' }
    );
  };

  const nudgeField = (target: HTMLElement | null) => {
    if (!target || prefersReducedMotion()) return;
    gsap.fromTo(
      target,
      { x: 0 },
      {
        keyframes: [
          { x: -6, duration: 0.06 },
          { x: 6, duration: 0.06 },
          { x: -4, duration: 0.06 },
          { x: 4, duration: 0.06 },
          { x: 0, duration: 0.06 }
        ],
        ease: 'power2.out',
        clearProps: 'transform'
      }
    );
  };

  const handleShuffleAvatar = () => {
    const nextSeed = `${username || 'user'}-${Math.random().toString(36).slice(2, 7)}`;
    setAvatarSeed(nextSeed);
    animateAvatarPop();

    if (avatarShuffleIconRef.current && !prefersReducedMotion()) {
      gsap.fromTo(
        avatarShuffleIconRef.current,
        { rotation: 0 },
        { rotation: 180, duration: 0.42, ease: 'power2.out', clearProps: 'transform' }
      );
    }
  };

  const handleRegenerateUsername = () => {
    const nextUsername = generateRandomUsername();
    setUsername(nextUsername);
    setAvatarSeed(nextUsername);
    setUsernameError(null);
    animateAvatarPop();

    if (!prefersReducedMotion()) {
      if (usernameShuffleIconRef.current) {
        gsap.fromTo(
          usernameShuffleIconRef.current,
          { rotation: 0 },
          { rotation: 180, duration: 0.42, ease: 'power2.out', clearProps: 'transform' }
        );
      }
      if (usernameInputRef.current) {
        gsap.fromTo(
          usernameInputRef.current,
          { opacity: 0.45, y: 3 },
          { opacity: 1, y: 0, duration: 0.24, ease: 'power2.out', clearProps: 'transform' }
        );
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const cleanName = name.trim();
    const cleanUsername = normalizeUsername(username);

    let hasError = false;
    if (!cleanName) {
      setNameError('Please enter your name.');
      nudgeField(nameGroupRef.current);
      hasError = true;
    } else {
      setNameError(null);
    }

    if (cleanUsername.length < 3) {
      setUsernameError('Username must be at least 3 characters.');
      nudgeField(usernameGroupRef.current);
      hasError = true;
    } else {
      setUsernameError(null);
    }

    if (hasError) return;

    setIsSubmitting(true);
    try {
      let finalId = accountId;
      let finalPlan = accountPlan;
      let finalAvatar = avatarUrl;

      if (isAuthenticated) {
        const res = await fetch('/api/auth/me', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            displayName: cleanName,
            username: cleanUsername,
            avatarUrl
          })
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          account?: {
            id: string;
            displayName: string;
            username: string;
            avatarUrl: string;
            plan: string;
          };
        };

        if (!res.ok) {
          const msg = data.error || 'Could not save your profile.';
          if (res.status === 409 || msg.toLowerCase().includes('username')) {
            setUsernameError(msg);
            nudgeField(usernameGroupRef.current);
          } else {
            toast.error(msg);
          }
          setIsSubmitting(false);
          return;
        }

        if (data.account) {
          finalId = data.account.id;
          finalPlan = data.account.plan;
          finalAvatar = data.account.avatarUrl;
        }
      }

      await saveUserProfileClient(
        {
          id: finalId,
          name: cleanName,
          username: cleanUsername,
          avatar: finalAvatar,
          plan: finalPlan,
          age: '18 or older'
        },
        { skipRemoteSync: true }
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.profile })
      ]);

      if (containerRef.current && !prefersReducedMotion()) {
        await gsap.to(containerRef.current, {
          opacity: 0,
          y: -10,
          duration: 0.24,
          ease: 'power2.in'
        });
      }

      router.push('/');
      router.refresh();
    } catch {
      toast.error('Network error while saving your profile.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="custom-scrollbar h-dvh w-full overflow-x-hidden overflow-y-auto bg-[var(--dc-canvas)] text-[var(--dc-text)]">
      {/* Minimal header matching /login and /verify */}
      <header className="mx-auto flex h-16 max-w-6xl items-center px-6">
        <Link href="/" aria-label="DeepChat" className="inline-flex items-center">
          <span
            role="img"
            aria-label="DeepChat"
            className="inline-block h-7 w-[136px] bg-[var(--dc-text-strong)]"
            style={{
              WebkitMaskImage: 'url("/brand/brand_with_name.svg")',
              maskImage: 'url("/brand/brand_with_name.svg")',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'left center',
              maskPosition: 'left center',
              WebkitMaskSize: 'contain',
              maskSize: 'contain'
            }}
          />
        </Link>
      </header>

      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl items-center justify-center px-6 pb-14 pt-4">
        <div ref={containerRef} className="w-full max-w-[420px]">
          {/* Avatar preview with subtle shuffle & lazy skeleton */}
          <div data-gs-stagger className="mb-7 flex items-center gap-4">
            <div ref={avatarWrapRef} className="relative h-16 w-16 shrink-0">
              {!isHydrated ? (
                <div className="h-16 w-16 animate-pulse rounded-full border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)]" />
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl}
                    alt="Your avatar"
                    loading="lazy"
                    className="h-16 w-16 rounded-full border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] object-cover shadow-xs transition-opacity duration-300"
                  />
                  <button
                    type="button"
                    onClick={handleShuffleAvatar}
                    title="Change avatar look"
                    aria-label="Change avatar look"
                    className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--dc-border-subtle)] bg-[var(--dc-canvas)] text-[var(--dc-text-muted)] shadow-xs transition-all duration-200 hover:border-[var(--dc-border-strong)] hover:text-[var(--dc-text-strong)] active:scale-90"
                  >
                    <span ref={avatarShuffleIconRef} className="inline-flex">
                      <RefreshCw className="h-3 w-3" />
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Editorial headline */}
          <div data-gs-stagger className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--dc-text-strong)] sm:text-[32px]">
              Hello, tell us your name
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--dc-text-muted)]">
              This is how you&apos;ll appear across DeepChat. You can update it anytime.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Name input */}
            <div ref={nameGroupRef} data-gs-stagger>
              <label
                htmlFor="gs-name"
                className="mb-2 block text-sm font-medium text-[var(--dc-text-strong)]"
              >
                Your name
              </label>
              <input
                id="gs-name"
                type="text"
                autoFocus
                autoComplete="name"
                maxLength={64}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="e.g. Alex Rivera"
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? 'gs-name-error' : undefined}
                className={`h-12 w-full rounded-2xl border bg-[var(--dc-surface)] px-4 text-base text-[var(--dc-text-strong)] placeholder:text-[var(--dc-text-muted)]/60 outline-none transition-all duration-200 ${
                  nameError
                    ? 'border-red-500/70 focus:border-red-500 focus:ring-2 focus:ring-red-500/15'
                    : 'border-[var(--dc-border-subtle)] focus:border-[var(--dc-border-strong)] focus:ring-2 focus:ring-[var(--dc-text-strong)]/10'
                }`}
              />
              {nameError && (
                <p id="gs-name-error" role="alert" className="mt-1.5 text-xs text-red-500">
                  {nameError}
                </p>
              )}
            </div>

            {/* Randomly generated & editable username */}
            <div ref={usernameGroupRef} data-gs-stagger>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="gs-username"
                  className="text-sm font-medium text-[var(--dc-text-strong)]"
                >
                  Username
                </label>
                <span className="text-xs text-[var(--dc-text-muted)]">Editable</span>
              </div>
              <div
                className={`flex h-12 w-full items-center rounded-2xl border bg-[var(--dc-surface)] pl-4 pr-2 transition-all duration-200 ${
                  usernameError
                    ? 'border-red-500/70 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/15'
                    : 'border-[var(--dc-border-subtle)] focus-within:border-[var(--dc-border-strong)] focus-within:ring-2 focus-within:ring-[var(--dc-text-strong)]/10'
                }`}
              >
                <span className="select-none text-base text-[var(--dc-text-muted)]">@</span>
                <input
                  ref={usernameInputRef}
                  id="gs-username"
                  type="text"
                  autoComplete="username"
                  spellCheck={false}
                  autoCapitalize="none"
                  maxLength={32}
                  value={username}
                  onChange={(e) => {
                    const next = normalizeUsername(e.target.value);
                    setUsername(next);
                    if (usernameError) setUsernameError(null);
                  }}
                  placeholder="username"
                  aria-invalid={Boolean(usernameError)}
                  aria-describedby={usernameError ? 'gs-username-error' : undefined}
                  className="min-w-0 flex-1 bg-transparent pl-1 text-base text-[var(--dc-text-strong)] placeholder:text-[var(--dc-text-muted)]/60 outline-none"
                />
                <button
                  type="button"
                  onClick={handleRegenerateUsername}
                  title="Generate another username"
                  aria-label="Generate another username"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[var(--dc-text-muted)] transition-colors duration-200 hover:bg-[var(--dc-canvas)] hover:text-[var(--dc-text-strong)] active:scale-90"
                >
                  <span ref={usernameShuffleIconRef} className="inline-flex">
                    <RefreshCw className="h-4 w-4" />
                  </span>
                </button>
              </div>
              {usernameError && (
                <p id="gs-username-error" role="alert" className="mt-1.5 text-xs text-red-500">
                  {usernameError}
                </p>
              )}
            </div>

            {/* Submit */}
            <div data-gs-stagger className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--dc-invert)] px-6 text-sm font-medium text-[var(--dc-text-on-invert)] transition-all duration-200 hover:opacity-92 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
