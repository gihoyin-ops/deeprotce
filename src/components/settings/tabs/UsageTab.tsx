'use client';

import React, { useEffect, useState } from 'react';
import { X } from '@/components/ui/icons';

interface UsageWindow {
  window: '5h' | '7d';
  limitLabel: string;
  usedTokens: number;
  remainingTokens: number | null;
  exhausted: boolean;
  resetsAt: string;
}

interface UsageResponse {
  ok: boolean;
  available: boolean;
  enforced: boolean;
  error?: string;
  plan?: string;
  planId?: string;
  limitTokens?: number | null;
  limitLabel?: string;
  usedTokens?: number;
  remainingTokens?: number | null;
  unlimited?: boolean;
  windows?: UsageWindow[];
}

interface PlanItem {
  id: string;
  label: string;
  limitTokens: number | null;
  limitLabel: string;
  unlimited: boolean;
  windows: string[];
}

function formatTimeRemaining(iso: string): string {
  const diffMs = Math.max(0, new Date(iso).getTime() - Date.now());
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Resets in ${days}d ${hours}h`;
  if (hours > 0) return `Resets in ${hours}h ${minutes}m`;
  return `Resets in ${Math.max(1, minutes)}m`;
}

function formatTokenCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Unlimited';
  return new Intl.NumberFormat('en-US').format(value);
}

export function UsageTab() {
  const [subTab, setSubTab] = useState<'overview' | 'analytics'>('overview');
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlansOpen, setIsPlansOpen] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/usage').then(r => (r.ok ? r.json() : null)),
      fetch('/api/usage/plans').then(r => (r.ok ? r.json() : null))
    ])
      .then(([usageData, plansData]) => {
        if (!active) return;
        if (usageData) setUsage(usageData);
        if (plansData?.plans) setPlans(plansData.plans);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const planName = usage?.plan || 'Free';
  const planLimitLabel = usage?.unlimited
    ? 'Unlimited tokens'
    : `${usage?.limitLabel || '40M'} tokens per window`;

  const windows: UsageWindow[] = usage?.windows?.length
    ? usage.windows
    : [
        {
          window: '5h',
          limitLabel: usage?.limitLabel || '40M',
          usedTokens: 0,
          remainingTokens: usage?.limitTokens ?? 40_000_000,
          exhausted: false,
          resetsAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString()
        },
        {
          window: '7d',
          limitLabel: usage?.limitLabel || '40M',
          usedTokens: 0,
          remainingTokens: usage?.limitTokens ?? 40_000_000,
          exhausted: false,
          resetsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

  const getWindowTitle = (w: '5h' | '7d') =>
    w === '5h' ? '5-hour usage limit' : '7-day usage limit';

  const getRemainingPercent = (w: UsageWindow): number => {
    if (usage?.unlimited || w.remainingTokens === null) return 100;
    const total = w.usedTokens + w.remainingTokens;
    if (total <= 0) return 100;
    return Math.max(0, Math.min(100, Math.round((w.remainingTokens / total) * 100)));
  };

  return (
    <div className="space-y-6">
      <header>
        <h3 className="text-2xl font-semibold tracking-tight text-[var(--dc-text-strong)]">Usage</h3>
        <p className="mt-1 text-sm text-[var(--dc-text-muted)]">Track your usage and check your limits</p>
      </header>

      {/* 2 tabs: Overview | Analytics (matches screenshot 4) */}
      <div className="flex items-center gap-1.5" role="tablist" aria-label="Usage views">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'overview'}
          onClick={() => setSubTab('overview')}
          className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
            subTab === 'overview'
              ? 'bg-[var(--dc-fill)] font-medium text-[var(--dc-text-strong)]'
              : 'text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'analytics'}
          onClick={() => setSubTab('analytics')}
          className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
            subTab === 'analytics'
              ? 'bg-[var(--dc-fill)] font-medium text-[var(--dc-text-strong)]'
              : 'text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]'
          }`}
        >
          Analytics
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-20 animate-pulse rounded-2xl bg-[var(--dc-surface-muted)]" />
          <div className="h-24 animate-pulse rounded-2xl bg-[var(--dc-surface-muted)]" />
          <div className="h-24 animate-pulse rounded-2xl bg-[var(--dc-surface-muted)]" />
        </div>
      ) : subTab === 'overview' ? (
        <div className="space-y-8">
          {/* Your plan */}
          <section>
            <h4 className="border-b border-[var(--dc-border-subtle)] pb-3 text-base font-medium text-[var(--dc-text-strong)]">
              Your plan
            </h4>
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-semibold text-[var(--dc-text-strong)]">DeepChat {planName}</p>
                <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">{planLimitLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPlansOpen(true)}
                className="rounded-full bg-[var(--dc-fill)] px-4 py-2 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill-hover)]"
              >
                View plans
              </button>
            </div>
          </section>

          {/* Plan limits */}
          <section className="space-y-4">
            <div className="border-b border-[var(--dc-border-subtle)] pb-3">
              <h4 className="text-base font-medium text-[var(--dc-text-strong)]">Plan limits</h4>
              <p className="mt-1 text-xs leading-relaxed text-[var(--dc-text-muted)]">
                Token limits apply per rolling 5-hour and 7-day window on your active DeepChat plan.{' '}
                <button
                  type="button"
                  onClick={() => setIsPlansOpen(true)}
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Compare plan limits
                </button>
              </p>
            </div>

            {usage && !usage.available && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                {usage.error || 'Usage ledger is currently unavailable; limits are not enforced in this environment.'}
              </div>
            )}

            <div className="space-y-3">
              {windows.map(win => {
                const pct = getRemainingPercent(win);
                return (
                  <div
                    key={win.window}
                    className="rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] p-4"
                  >
                    <p className="text-sm font-semibold text-[var(--dc-text-strong)]">
                      {getWindowTitle(win.window)}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-[var(--dc-text-muted)]">
                      <span>{formatTimeRemaining(win.resetsAt)}</span>
                      <span>
                        {usage?.unlimited ? 'Unlimited' : `${pct}% remaining`}
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--dc-fill)]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          pct <= 15
                            ? 'bg-red-500'
                            : 'bg-[var(--dc-text-strong)]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        /* Analytics tab */
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] p-4">
              <p className="text-xs font-medium text-[var(--dc-text-muted)]">Active Plan</p>
              <p className="mt-1 text-lg font-semibold text-[var(--dc-text-strong)]">DeepChat {planName}</p>
              <p className="mt-1 text-xs text-[var(--dc-text-muted)]">
                Status: {usage?.enforced ? 'Enforced' : 'Not enforced'}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] p-4">
              <p className="text-xs font-medium text-[var(--dc-text-muted)]">Window Allowance</p>
              <p className="mt-1 text-lg font-semibold text-[var(--dc-text-strong)]">
                {usage?.unlimited ? '∞ Unlimited' : `${usage?.limitLabel || '40M'} tokens`}
              </p>
              <p className="mt-1 text-xs text-[var(--dc-text-muted)]">Applies to 5h &amp; 7d windows</p>
            </div>
          </div>

          <div className="space-y-3">
            {windows.map(win => {
              const pct = getRemainingPercent(win);
              return (
                <div
                  key={win.window}
                  className="rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-[var(--dc-text-strong)]">
                      {getWindowTitle(win.window)}
                    </p>
                    <span className="rounded-full bg-[var(--dc-fill)] px-2.5 py-0.5 text-xs font-medium text-[var(--dc-text-strong)]">
                      {win.exhausted ? 'Exhausted' : `${pct}% left`}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-[var(--dc-text-muted)]">Used</p>
                      <p className="mt-0.5 font-medium text-[var(--dc-text-strong)]">
                        {formatTokenCount(win.usedTokens)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--dc-text-muted)]">Remaining</p>
                      <p className="mt-0.5 font-medium text-[var(--dc-text-strong)]">
                        {formatTokenCount(win.remainingTokens)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--dc-text-muted)]">Window Cap</p>
                      <p className="mt-0.5 font-medium text-[var(--dc-text-strong)]">
                        {win.limitLabel}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View plans modal */}
      {isPlansOpen && (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={() => setIsPlansOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Available plans"
            className="w-full max-w-lg rounded-3xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-6 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--dc-text-strong)]">DeepChat Plans</h3>
                <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                  Token allowances per 5-hour and 7-day rolling window
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPlansOpen(false)}
                aria-label="Close plans"
                className="rounded-full p-1.5 text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {plans.map(plan => {
                const isCurrent = plan.id === (usage?.planId || 'free');
                return (
                  <div
                    key={plan.id}
                    className={`flex items-center justify-between rounded-2xl border p-4 ${
                      isCurrent
                        ? 'border-[var(--dc-text-strong)] bg-[var(--dc-surface-muted)]'
                        : 'border-[var(--dc-border)] bg-[var(--dc-surface)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--dc-text-strong)]">{plan.label}</p>
                        {isCurrent && (
                          <span className="rounded-full bg-[var(--dc-invert)] px-2 py-0.5 text-[10px] font-semibold text-[var(--dc-text-on-invert)]">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                        Windows: {plan.windows.join(' & ')}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-[var(--dc-text-strong)]">
                      {plan.unlimited ? '∞ Unlimited' : `${plan.limitLabel} tokens`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
