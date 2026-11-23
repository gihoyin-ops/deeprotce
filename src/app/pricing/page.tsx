'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check } from '@/components/ui/icons';

interface PlanItem {
  id: string;
  label: string;
}

const PLAN_DETAILS: Record<
  string,
  {
    price: string;
    period: string;
    subtitle: string;
    ctaLabel: string;
    badge?: string;
    features: string[];
  }
> = {
  free: {
    price: '$0',
    period: '/ month',
    subtitle: 'Explore DeepChat for everyday questions and quick tasks',
    ctaLabel: 'Free plan',
    features: [
      'Standard usage limits',
      'Access to core chat and web search',
      'Standard image generation',
      'Local chat history and memory'
    ]
  },
  supporters: {
    price: '$12',
    period: '/ month',
    subtitle: 'More capacity and creative tools for regular users',
    ctaLabel: 'Upgrade to Supporters',
    badge: 'Popular',
    features: [
      'Higher usage limits',
      'Access to GPT Image 2.6 generation',
      'Unlock advanced reasoning and models',
      'Full personalization and custom workflows'
    ]
  },
  cool: {
    price: '$29',
    period: '/ month',
    subtitle: 'Maximum power for heavy research, coding, and creation',
    ctaLabel: 'Upgrade to Cools',
    features: [
      'Much higher usage limits',
      'Priority access to GPT Image 2.6',
      'Unlock all advanced models and agents',
      'Extended context and faster response priority'
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
        if (plansData?.plans) {
          setPlans(
            (plansData.plans as PlanItem[]).filter(plan => plan.id !== 'owner')
          );
        }
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
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <span className="text-lg font-bold tracking-tight text-[var(--dc-text-strong)]">DeepChat</span>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)] px-4 py-1.5 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-surface-hover)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to DeepChat</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--dc-text-strong)] sm:text-4xl">
            Upgrade your plan
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--dc-text-muted)] sm:text-base">
            Choose the plan that fits how you chat, create with GPT Image 2.6, and build with DeepChat.
          </p>
        </div>

        {isLoading ? (
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-96 animate-pulse rounded-3xl bg-[var(--dc-surface-muted)]" />
            ))}
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {plans.map(plan => {
              const meta = PLAN_DETAILS[plan.id] || {
                price: '$0',
                period: '/ month',
                subtitle: 'DeepChat plan',
                ctaLabel: `Upgrade to ${plan.label}`,
                features: ['Standard access']
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
                      <h2 className="text-xl font-semibold text-[var(--dc-text-strong)]">{plan.label}</h2>
                      {isCurrent ? (
                        <span className="rounded-full bg-[var(--dc-fill)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--dc-text-strong)]">
                          Current plan
                        </span>
                      ) : meta.badge ? (
                        <span className="rounded-full bg-blue-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                          {meta.badge}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold tracking-tight text-[var(--dc-text-strong)]">
                        {meta.price}
                      </span>
                      <span className="text-xs text-[var(--dc-text-muted)]">{meta.period}</span>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-[var(--dc-text-muted)]">
                      {meta.subtitle}
                    </p>

                    <ul className="mt-6 space-y-3 border-t border-[var(--dc-border-subtle)] pt-5">
                      {meta.features.map(feature => (
                        <li key={feature} className="flex items-start gap-2.5 text-sm text-[var(--dc-text)]">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dc-text-strong)]" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8 pt-2">
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="w-full cursor-not-allowed rounded-full bg-[var(--dc-fill)] py-2.5 text-center text-sm font-medium text-[var(--dc-text-muted)] opacity-75"
                    >
                      {isCurrent ? 'Your current plan' : meta.ctaLabel}
                    </button>
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
