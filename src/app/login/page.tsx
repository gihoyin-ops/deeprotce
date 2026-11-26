'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { gsap } from 'gsap';
import toast from 'react-hot-toast';
import { AUTH_SESSION_QUERY_KEY } from '@/lib/auth/guest';
import { deepchatQueryKeys } from '@/lib/query-keys';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import { Check } from '@/components/ui/icons';
import PasswordToggleButton from '@/components/ui/PasswordToggleButton';
import LoginShowcaseMedia from './LoginShowcaseMedia';
import PlanetFaqSection from './PlanetFaqSection';

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const passwordSectionRef = useRef<HTMLDivElement | null>(null);
  const rememberBoxRef = useRef<HTMLSpanElement | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const el = passwordSectionRef.current;
    if (!el || step !== 'password' || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { height: 0, opacity: 0, y: -6 },
        {
          height: 'auto',
          opacity: 1,
          y: 0,
          duration: 0.36,
          ease: 'power3.out',
          clearProps: 'height',
        }
      );
      gsap.fromTo(
        el.querySelectorAll('[data-gsap-stagger]'),
        { opacity: 0, y: 6 },
        {
          opacity: 1,
          y: 0,
          duration: 0.28,
          stagger: 0.05,
          delay: 0.06,
          ease: 'power2.out',
        }
      );
    }, passwordSectionRef);

    return () => ctx.revert();
  }, [step]);

  const handleToggleRemember = () => {
    setRememberMe((prev) => !prev);
    if (rememberBoxRef.current && !prefersReducedMotion()) {
      gsap.fromTo(
        rememberBoxRef.current,
        { scale: 0.82 },
        { scale: 1, duration: 0.28, ease: 'back.out(2.2)' }
      );
    }
  };

  const handleOAuthClick = (provider: 'Google' | 'Apple') => {
    toast(`${provider} OAuth is not configured yet. Please continue with email.`);
  };

  const sendOtpAndRedirect = async (targetEmail: string, isNewAccount: boolean) => {
    const res = await fetch('/api/auth/otp/send', {
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

    if (!res.ok && res.status !== 429) {
      toast.error(data.error || 'Failed to send verification code.');
      return;
    }

    if (res.status === 429 && data.error) {
      toast(data.error);
    } else {
      toast.success('Verification code sent. Check your inbox or spam folder.');
    }

    const params = new URLSearchParams({ email: targetEmail });
    if (isNewAccount) params.set('new', '1');
    if (typeof data.resendAfterSeconds === 'number') {
      params.set('cooldown', String(data.resendAfterSeconds));
    } else if (typeof data.retryAfterSeconds === 'number') {
      params.set('cooldown', String(data.retryAfterSeconds));
    }
    router.push(`/verify?${params.toString()}`);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Please enter a valid email address.');
      return;
    }

    if (step === 'email') {
      setIsSubmitting(true);
      try {
        const res = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ email: trimmed }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          exists?: boolean;
          hasPassword?: boolean;
          error?: string;
        };

        if (!res.ok) {
          toast.error(data.error || 'Unable to verify email.');
          return;
        }

        if (data.exists && data.hasPassword) {
          setStep('password');
          return;
        }

        await sendOtpAndRedirect(trimmed, !data.exists);
      } catch {
        toast.error('Network error while checking account.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) {
      toast.error('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: trimmed, password, rememberMe }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        account?: { needsOnboarding?: boolean };
      };
      if (!res.ok) {
        toast.error(data.error || 'Invalid email or password.');
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: deepchatQueryKeys.profile }),
      ]);
      if (data.account?.needsOnboarding) {
        router.push('/get-started');
      } else {
        toast.success(`Signed in as ${trimmed}`);
        router.push('/');
      }
      router.refresh();
    } catch {
      toast.error('Network error while signing in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      ref={scrollContainerRef}
      className="custom-scrollbar h-dvh w-full overflow-x-hidden overflow-y-auto bg-[var(--dc-canvas)] text-[var(--dc-text)]"
    >
      {/* Bare-ass header, no divider line or extra buttons cluttering it up */}
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

      {/* Main login hero, looping video on the left and auth card on the right */}
      <main>
        <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl items-center px-6 py-8 sm:py-12">
          <div className="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
            {/* Left side looping video showcase */}
            <div className="lg:col-span-6">
              <LoginShowcaseMedia />
            </div>

            {/* Right side headline and login card */}
            <div className="mx-auto w-full max-w-[400px] lg:col-span-6">
              <div className="mb-7 text-center">
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--dc-text-strong)] sm:text-[40px] sm:leading-[1.12]">
                  Think deeper, build faster
                </h1>
                <p className="mt-2.5 text-sm leading-relaxed text-[var(--dc-text-muted)] sm:text-[15px]">
                  Your intelligent workspace for reasoning, code, and creation
                </p>
              </div>

              <div className="rounded-[24px] border border-[var(--dc-border-subtle)] bg-[var(--dc-panel)] p-6 shadow-lg shadow-[var(--dc-shadow-color)] sm:p-7">
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => handleOAuthClick('Google')}
                    className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-[var(--dc-surface-muted)] px-4 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-surface-hover)]"
                  >
                    <GoogleIcon />
                    <span>Continue with Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOAuthClick('Apple')}
                    className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl bg-[var(--dc-surface-muted)] px-4 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-surface-hover)]"
                  >
                    <AppleIcon />
                    <span>Continue with Apple</span>
                  </button>
                </div>

                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[var(--dc-border-subtle)]" />
                  <span className="text-[11px] font-medium tracking-wider text-[var(--dc-text-faint)] uppercase">
                    OR
                  </span>
                  <div className="h-px flex-1 bg-[var(--dc-border-subtle)]" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                  <div className="relative">
                    <label htmlFor="login-email" className="sr-only">
                      Email address
                    </label>
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      readOnly={step === 'password'}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (step === 'password') {
                          setStep('email');
                          setPassword('');
                        }
                      }}
                      placeholder="Enter your email"
                      className={`h-11 w-full rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-input)] px-3.5 text-sm text-[var(--dc-text-strong)] placeholder:text-[var(--dc-text-placeholder)] transition-colors focus:border-[var(--deepchat-accent)] focus:ring-2 focus:ring-[var(--deepchat-accent)]/20 focus:outline-none ${
                        step === 'password' ? 'pr-20 opacity-85' : ''
                      }`}
                    />
                    {step === 'password' && (
                      <button
                        type="button"
                        onClick={() => {
                          setStep('email');
                          setPassword('');
                        }}
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
                      >
                        Change
                      </button>
                    )}
                  </div>

                  {step === 'password' && (
                    <div ref={passwordSectionRef} className="overflow-hidden space-y-3">
                      <div data-gsap-stagger="" className="relative">
                        <label htmlFor="login-password" className="sr-only">
                          Password
                        </label>
                        <input
                          id="login-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          autoFocus
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="h-11 w-full rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-input)] px-3.5 pr-12 text-sm text-[var(--dc-text-strong)] placeholder:text-[var(--dc-text-placeholder)] transition-colors focus:border-[var(--deepchat-accent)] focus:ring-2 focus:ring-[var(--deepchat-accent)]/20 focus:outline-none"
                        />
                        <PasswordToggleButton
                          visible={showPassword}
                          onToggle={() => setShowPassword((prev) => !prev)}
                        />
                      </div>

                      <div
                        data-gsap-stagger=""
                        className="flex items-center justify-between gap-2 px-0.5 text-xs"
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={rememberMe}
                          onClick={handleToggleRemember}
                          className="group inline-flex items-center gap-2 text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)]"
                        >
                          <span
                            ref={rememberBoxRef}
                            className={`flex h-4 w-4 items-center justify-center rounded-[5px] border transition-colors ${
                              rememberMe
                                ? 'border-[var(--dc-invert)] bg-[var(--dc-invert)] text-[var(--dc-text-on-invert)]'
                                : 'border-[var(--dc-border-strong)] bg-[var(--dc-surface-input)]'
                            }`}
                          >
                            {rememberMe && <Check className="h-3 w-3" strokeWidth={2.5} />}
                          </span>
                          <span>Remember me</span>
                        </button>

                        <Link
                          href={`/forgot-password?email=${encodeURIComponent(email.trim().toLowerCase())}`}
                          className="font-medium text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)]"
                        >
                          Forgot password?
                        </Link>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex h-11 w-full items-center justify-center rounded-xl bg-[var(--dc-invert)] px-4 text-sm font-medium text-[var(--dc-text-on-invert)] transition-all hover:bg-[var(--dc-invert-hover)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting
                      ? step === 'password'
                        ? 'Signing in...'
                        : 'Checking...'
                      : step === 'password'
                        ? 'Sign in'
                        : 'Continue with email'}
                  </button>
                </form>

                <p className="mt-5 text-center text-[11px] leading-relaxed text-[var(--dc-text-muted)]">
                  By continuing, you acknowledge DeepChat&apos;s{' '}
                  <a
                    href="https://www.deepsia.my.id/policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-[var(--dc-border-strong)] underline-offset-2 transition-colors hover:text-[var(--dc-text-strong)]"
                  >
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Dead scroll space -> bottom circle blowing up full screen -> 4-question FAQ */}
        <PlanetFaqSection scrollContainerRef={scrollContainerRef} />
      </main>
    </div>
  );
}
