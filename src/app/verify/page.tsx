'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { gsap } from 'gsap';
import toast from 'react-hot-toast';
import { AUTH_SESSION_QUERY_KEY } from '@/lib/auth/guest';
import { deepchatQueryKeys } from '@/lib/query-keys';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import PasswordToggleButton from '@/components/ui/PasswordToggleButton';

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const cardRef = useRef<HTMLDivElement | null>(null);

  const initialEmail = (searchParams.get('email') || '').trim().toLowerCase();
  const isNewAccount = searchParams.get('new') === '1';
  const initialCooldown = Number.parseInt(searchParams.get('cooldown') || '0', 10);

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(
    Number.isFinite(initialCooldown) && initialCooldown > 0 ? initialCooldown : 0
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }
      );
    }, cardRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        resendAfterSeconds?: number;
        retryAfterSeconds?: number;
      };
      if (!res.ok) {
        if (typeof data.retryAfterSeconds === 'number' && data.retryAfterSeconds > 0) {
          setResendCooldown(data.retryAfterSeconds);
        }
        toast.error(data.error || 'Failed to resend code.');
        return;
      }

      setResendCooldown(typeof data.resendAfterSeconds === 'number' ? data.resendAfterSeconds : 45);
      toast.success('New verification code sent. Check your inbox or spam folder.');
    } catch {
      toast.error('Network error while resending code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    const cleanCode = code.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      toast.error('Please enter the 6-digit verification code.');
      return;
    }

    if (password && (password.length < 8 || password.length > 128)) {
      toast.error('Password must be between 8 and 128 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: trimmed,
          code: cleanCode,
          ...(password ? { password } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'Invalid or expired verification code.');
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.profile }),
      ]);
      toast.success(`Verified! Welcome to DeepChat, ${trimmed}`);
      router.push('/');
      router.refresh();
    } catch {
      toast.error('Network error while verifying email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="custom-scrollbar h-dvh w-full overflow-x-hidden overflow-y-auto bg-[var(--dc-canvas)] text-[var(--dc-text)]">
      {/* Clean minimal header matching /login */}
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
              maskSize: 'contain',
            }}
          />
        </Link>
      </header>

      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl items-center justify-center px-6 py-10">
        <div ref={cardRef} className="w-full max-w-[400px]">
          <div className="mb-7 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--dc-text-strong)] sm:text-[36px] sm:leading-[1.15]">
              Verify your email
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-[var(--dc-text-muted)]">
              {email
                ? `Enter the 6-digit code we sent to ${email}`
                : 'Enter your email and 6-digit verification code to continue.'}
            </p>
          </div>

          <div className="rounded-[24px] border border-[var(--dc-border-subtle)] bg-[var(--dc-panel)] p-6 shadow-lg shadow-[var(--dc-shadow-color)] sm:p-7">
            <div className="mb-4 rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-muted)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--dc-text-muted)]">
              Didn&apos;t receive the email? Please check your{' '}
              <span className="font-medium text-[var(--dc-text-strong)]">
                Spam, Junk, or Promotions
              </span>{' '}
              folder before requesting a new code.
            </div>

            <form onSubmit={handleVerify} className="space-y-3" noValidate>
              {!initialEmail && (
                <div>
                  <label htmlFor="verify-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="verify-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="h-11 w-full rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-input)] px-3.5 text-sm text-[var(--dc-text-strong)] placeholder:text-[var(--dc-text-placeholder)] transition-colors focus:border-[var(--deepchat-accent)] focus:ring-2 focus:ring-[var(--deepchat-accent)]/20 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label htmlFor="verify-code" className="sr-only">
                  6-digit verification code
                </label>
                <input
                  id="verify-code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  className="h-11 w-full rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-input)] px-3.5 text-center text-base font-semibold tracking-[0.35em] text-[var(--dc-text-strong)] placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-[var(--dc-text-placeholder)] transition-colors focus:border-[var(--deepchat-accent)] focus:ring-2 focus:ring-[var(--deepchat-accent)]/20 focus:outline-none"
                />
              </div>

              {isNewAccount && (
                <div className="relative">
                  <label htmlFor="verify-password" className="sr-only">
                    Create a password (optional)
                  </label>
                  <input
                    id="verify-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create password (min. 8 chars, optional)"
                    className="h-11 w-full rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-input)] px-3.5 pr-12 text-sm text-[var(--dc-text-strong)] placeholder:text-[var(--dc-text-placeholder)] transition-colors focus:border-[var(--deepchat-accent)] focus:ring-2 focus:ring-[var(--deepchat-accent)]/20 focus:outline-none"
                  />
                  <PasswordToggleButton
                    visible={showPassword}
                    onToggle={() => setShowPassword((prev) => !prev)}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-[var(--dc-invert)] px-4 text-sm font-medium text-[var(--dc-text-on-invert)] transition-all hover:bg-[var(--dc-invert-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Verifying...' : 'Verify & continue'}
              </button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  disabled={isSubmitting || resendCooldown > 0}
                  onClick={handleResend}
                  className="font-medium text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                </button>
                <Link
                  href="/login"
                  className="font-medium text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)]"
                >
                  Use another email
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="h-dvh w-full bg-[var(--dc-canvas)]" />}>
      <VerifyContent />
    </Suspense>
  );
}
