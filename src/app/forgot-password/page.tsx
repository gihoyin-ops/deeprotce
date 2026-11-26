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

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const cardRef = useRef<HTMLDivElement | null>(null);
  const resetFieldsRef = useRef<HTMLDivElement | null>(null);

  const [email, setEmail] = useState(() => (searchParams.get('email') || '').trim().toLowerCase());
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
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
    const el = resetFieldsRef.current;
    if (!el || step !== 'reset' || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { height: 0, opacity: 0, y: -6 },
        { height: 'auto', opacity: 1, y: 0, duration: 0.36, ease: 'power3.out', clearProps: 'height' }
      );
    }, resetFieldsRef);
    return () => ctx.revert();
  }, [step]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const sendResetCode = async (targetEmail: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/password/forgot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: targetEmail }),
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
        toast.error(data.error || 'Failed to send reset code.');
        return;
      }

      setStep('reset');
      setResendCooldown(typeof data.resendAfterSeconds === 'number' ? data.resendAfterSeconds : 45);
      toast.success('Reset code sent. Check your inbox or spam folder.');
    } catch {
      toast.error('Network error while sending reset code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    if (step === 'email') {
      await sendResetCode(trimmed);
      return;
    }

    const cleanCode = code.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      toast.error('Please enter the 6-digit reset code.');
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      toast.error('Password must be between 8 and 128 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: trimmed,
          code: cleanCode,
          newPassword,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'Failed to reset password.');
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.profile }),
      ]);
      toast.success('Password updated! You are now signed in.');
      router.push('/');
      router.refresh();
    } catch {
      toast.error('Network error while resetting password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="custom-scrollbar h-dvh w-full overflow-x-hidden overflow-y-auto bg-[var(--dc-canvas)] text-[var(--dc-text)]">
      {/* Barebones header matching /login */}
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
              Reset your password
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-[var(--dc-text-muted)]">
              {step === 'email'
                ? 'Enter your account email and we will send a 6-digit reset code.'
                : `We sent a 6-digit reset code to ${email.trim().toLowerCase()}.`}
            </p>
          </div>

          <div className="rounded-[24px] border border-[var(--dc-border-subtle)] bg-[var(--dc-panel)] p-6 shadow-lg shadow-[var(--dc-shadow-color)] sm:p-7">
            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
              <div>
                <label htmlFor="forgot-email" className="sr-only">
                  Email address
                </label>
                <input
                  id="forgot-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  readOnly={step === 'reset'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className={`h-11 w-full rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-input)] px-3.5 text-sm text-[var(--dc-text-strong)] placeholder:text-[var(--dc-text-placeholder)] transition-colors focus:border-[var(--deepchat-accent)] focus:ring-2 focus:ring-[var(--deepchat-accent)]/20 focus:outline-none ${
                    step === 'reset' ? 'opacity-75' : ''
                  }`}
                />
              </div>

              {step === 'reset' && (
                <div ref={resetFieldsRef} className="overflow-hidden space-y-3">
                  <div className="rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-muted)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--dc-text-muted)]">
                    Can&apos;t find the email? Please check your{' '}
                    <span className="font-medium text-[var(--dc-text-strong)]">
                      Spam, Junk, or Promotions
                    </span>{' '}
                    folder.
                  </div>

                  <div>
                    <label htmlFor="reset-code" className="sr-only">
                      6-digit reset code
                    </label>
                    <input
                      id="reset-code"
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

                  <div className="relative">
                    <label htmlFor="new-password" className="sr-only">
                      New password
                    </label>
                    <input
                      id="new-password"
                      name="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (min. 8 characters)"
                      className="h-11 w-full rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-input)] px-3.5 pr-12 text-sm text-[var(--dc-text-strong)] placeholder:text-[var(--dc-text-placeholder)] transition-colors focus:border-[var(--deepchat-accent)] focus:ring-2 focus:ring-[var(--deepchat-accent)]/20 focus:outline-none"
                    />
                    <PasswordToggleButton
                      visible={showPassword}
                      onToggle={() => setShowPassword((prev) => !prev)}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-[var(--dc-invert)] px-4 text-sm font-medium text-[var(--dc-text-on-invert)] transition-all hover:bg-[var(--dc-invert-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? step === 'email'
                    ? 'Sending code...'
                    : 'Resetting password...'
                  : step === 'email'
                    ? 'Send reset code'
                    : 'Reset password'}
              </button>

              {step === 'reset' && (
                <div className="flex items-center justify-between pt-1 text-xs">
                  <button
                    type="button"
                    disabled={isSubmitting || resendCooldown > 0}
                    onClick={() => sendResetCode(email.trim().toLowerCase())}
                    className="font-medium text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setCode('');
                      setNewPassword('');
                    }}
                    className="font-medium text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)]"
                  >
                    Change email
                  </button>
                </div>
              )}
            </form>

            <div className="mt-5 border-t border-[var(--dc-border-subtle)] pt-4 text-center">
              <Link
                href="/login"
                className="text-xs font-medium text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)]"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="h-dvh w-full bg-[var(--dc-canvas)]" />}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
