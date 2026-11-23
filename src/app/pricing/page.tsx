'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check } from '@/components/ui/icons';

interface PlanItem {
  id: string;
  label: string;
  limitTokens: number | null;
  limitLabel: string;
  unlimited: boolean;
  windows: string[];
}

const PLAN_DETAILS: Record<string, { subtitle: string; features: string[]; badge?: string }> = {
  free: {
    subtitle: 'For everyday conversations and quick tasks',
    features: [
      '40M tokens per 5-hour rolling window',
      '40M tokens per weekly rolling window',
      'Standard model access & web search',
      'Local chat history & memory'
    ]
  },
  supporters: {
    subtitle: 'Higher capacity for regular power users',
    badge: 'Popular',
    features: [
      '150M tokens per 5-hour rolling window',
      '150M tokens per weekly rolling window',
      'Priority headroom for long sessions',
      'Full personalization & tools access'
    ]
  },
  cool: {
    subtitle: 'Built for heavy coding, research, and workflows',
    features: [
      '650M tokens per 5-hour rolling window',
      '650M tokens per weekly rolling window',
      'Extended context & multi-step agents',
      'Ideal for daily deep work'
    ]
  },
  owner: {
    subtitle: 'Unrestricted access for workspace owners',
    features: [
      'Unlimited tokens per 5-hour window',
      'Unlimited tokens per weekly window',
      'No rate-budget caps',
      'Full administrative control'
    ]
  }
};

export default function PricingPage() {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [activePlanId, setActivePlanId] = useState<string>('free');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/usage/plans').then(r => (r.ok ? r.json() : null)),
      fetch('/api/usage').then(r => (r.ok ? r.json() : null))
    ])
      .then(([plansData, usageData]) => {
        if (!active) return;
        if (plansData?.plans) setPlans(plansData.plans);
        if (usageData?.planId) setActivePlanId(String(usageData.planId));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-full w-full bg-[var(--dc-canvas)] text-[var(--dc-text)]">
      {/* Standalone top bar (no chat wireframe) */}
      <header className="border-b border-[var(--dc-border-subtle)] bg-[var(--dc-panel)]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-tight text-[var(--dc-text-strong)]">DeepChat</span>
            <span className="rounded-full bg-[var(--dc-fill)] px-2.5 py-0.5 text-xs font-medium text-[var(--dc-text-muted)]">
              Plans &amp; Limits
            </span>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)] px-4 py-1.5 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-surface-hover)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to DeepChat</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--dc-text-strong)] sm:text-4xl">
            Compare plans &amp; token limits
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--dc-text-muted)] sm:text-base">
            Every tier includes rolling 5-hour and weekly token windows tailored to how much you build, research, and chat.
          </p>
        </div>

        {isLoading ? (
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-80 animate-pulse rounded-3xl bg-[var(--dc-surface-muted)]" />
            ))}
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map(plan => {
              const meta = PLAN_DETAILS[plan.id] || {
                subtitle: 'DeepChat workspace tier',
                features: [`${plan.limitLabel} tokens per window`]
              };
              const isCurrent = plan.id === activePlanId;

              return (
                <div
                  key={plan.id}
                  className={`flex flex-col justify-between rounded-3xl border p-6 transition-all ${
                    isCurrent
                      ? 'border-[var(--dc-text-strong)] bg-[var(--dc-panel)] shadow-lg'
                      : 'border-[var(--dc-border)] bg-[var(--dc-panel)]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-lg font-semibold text-[var(--dc-text-strong)]">{plan.label}</h2>
                      {isCurrent ? (
                        <span className="rounded-full bg-[var(--dc-invert)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--dc-text-on-invert)]">
                          Current
                        </span>
                      ) : meta.badge ? (
                        <span className="rounded-full bg-blue-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                          {meta.badge}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-xs leading-relaxed text-[var(--dc-text-muted)]">
                      {meta.subtitle}
                    </p>

                    <div className="mt-5 border-b border-[var(--dc-border-subtle)] pb-5">
                      <p className="text-3xl font-bold tracking-tight text-[var(--dc-text-strong)]">
                        {plan.unlimited ? '∞' : plan.limitLabel}
                      </p>
                      <p className="mt-1 text-xs text-[var(--dc-text-muted)]">
                        {plan.unlimited ? 'Unlimited tokens' : 'tokens per 5h & weekly window'}
                      </p>
                    </div>

                    <ul className="mt-5 space-y-2.5">
                      {meta.features.map(feature => (
                        <li key={feature} className="flex items-start gap-2.5 text-xs leading-relaxed text-[var(--dc-text)]">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--dc-text-strong)]" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-6 pt-2">
                    <div
                      className={`w-full rounded-full py-2.5 text-center text-xs font-semibold ${
                        isCurrent
                          ? 'bg-[var(--dc-fill)] text-[var(--dc-text-strong)]'
                          : 'border border-[var(--dc-border)] text-[var(--dc-text-muted)]'
                      }`}
                    >
                      {isCurrent ? 'Your active plan' : 'Managed by workspace'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
