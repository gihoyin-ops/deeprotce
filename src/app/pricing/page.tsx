'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check } from '@/components/ui/icons';
import { PillDropdown, type PillDropdownOption } from '@/components/settings/PillDropdown';

interface PlanItem {
  id: string;
  label: string;
  price: string;
  period: string;
}

type RegionCode = 'US' | 'CN' | 'ID' | 'JP' | 'RU';

const REGION_OPTIONS: PillDropdownOption[] = [
  { label: 'United States (USD $)', value: 'US' },
  { label: 'China (CNY ¥)', value: 'CN' },
  { label: 'Indonesia (IDR Rp)', value: 'ID' },
  { label: 'Japan (JPY ¥)', value: 'JP' },
  { label: 'Russia (RUB ₽)', value: 'RU' }
];

const PLAN_DETAILS: Record<
  string,
  {
    subtitle: string;
    ctaLabel: string;
    badge?: string;
    features: string[];
  }
> = {
  free: {
    subtitle: 'Explore Benthos for everyday questions and quick tasks',
    ctaLabel: 'Free plan',
    features: [
      'Standard usage limits',
      'Access to core chat and web search',
      'Standard image generation',
      'Local chat history and memory'
    ]
  },
  supporters: {
    subtitle: 'More capacity and creative tools for regular users',
    ctaLabel: 'Upgrade to Supporters',
    badge: 'Popular',
    features: [
      'Higher usage limits',
      'Access to GPT Image 2.5 generation',
      'Unlock advanced reasoning and models',
      'Full personalization and custom workflows'
    ]
  },
  cool: {
    subtitle: 'Maximum power for heavy research, coding, and creation',
    ctaLabel: 'Upgrade to Cools',
    features: [
      'Much higher usage limits',
      'Priority access to GPT Image 2.5',
      'Unlock all advanced models and agents',
      'Extended context and faster response priority'
    ]
  }
};

export default function PricingPage() {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [activePlanId, setActivePlanId] = useState<string>('free');
  const [region, setRegion] = useState<RegionCode>('US');
  const [isLoading, setIsLoading] = useState(true);
  const [isRegionLoading, setIsRegionLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchRegionalPricing = useCallback(async (targetRegion: RegionCode, initial = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (initial) {
      setIsLoading(true);
    } else {
      setIsRegionLoading(true);
    }

    try {
      const requests: [Promise<Response>, Promise<Response> | null] = [
        fetch(`/api/usage/pricing?region=${targetRegion}`, { signal: controller.signal }),
        initial ? fetch('/api/usage', { signal: controller.signal }) : null
      ];

      const [pricingRes, usageRes] = await Promise.all([
        requests[0],
        requests[1] ?? Promise.resolve(null)
      ]);

      if (controller.signal.aborted) return;

      if (pricingRes.ok) {
        const pricingData = await pricingRes.json();
        if (Array.isArray(pricingData?.plans)) {
          setPlans(pricingData.plans);
        }
      }

      if (usageRes && usageRes.ok) {
        const usageData = await usageRes.json();
        if (usageData?.planId) {
          setActivePlanId(String(usageData.planId));
        }
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsRegionLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchRegionalPricing('US', true);
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchRegionalPricing]);

  const handleRegionChange = (nextRegion: string) => {
    const code = nextRegion as RegionCode;
    setRegion(code);
    void fetchRegionalPricing(code, false);
  };

  return (
    <div className="min-h-full w-full bg-[var(--dc-canvas)] text-[var(--dc-text)]">
      {/* Standalone top bar without the chat wireframe bs */}
      <header className="border-b border-[var(--dc-border-subtle)] bg-[var(--dc-panel)]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" aria-label="Benthos" className="inline-flex items-center">
            <span
              role="img"
              aria-label="Benthos"
              className="inline-block h-8 w-[148px] bg-[var(--dc-text-strong)]"
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
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)] px-4 py-1.5 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-surface-hover)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Benthos</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--dc-text-strong)] sm:text-4xl">
            Upgrade your plan
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--dc-text-muted)] sm:text-base">
            Choose the plan that fits how you chat, create with GPT Image 2.5, and build with Benthos.
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
                subtitle: 'Benthos plan',
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

                    <div className="mt-4 flex min-h-[36px] items-baseline gap-1.5">
                      {isRegionLoading ? (
                        <div className="h-8 w-28 animate-pulse rounded-xl bg-[var(--dc-surface-muted)]" />
                      ) : (
                        <>
                          <span className="text-3xl font-bold tracking-tight text-[var(--dc-text-strong)]">
                            {plan.price}
                          </span>
                          <span className="text-xs text-[var(--dc-text-muted)]">{plan.period}</span>
                        </>
                      )}
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

        {/* Bottom-right currency region picker */}
        <div className="mt-10 flex items-center justify-end">
          <PillDropdown
            value={region}
            options={REGION_OPTIONS}
            align="right"
            onChange={handleRegionChange}
            ariaLabel="Select pricing region"
          />
        </div>
      </main>
    </div>
  );
}
