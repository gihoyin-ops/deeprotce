'use client';

import React, { useRef, useState } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { ArrowUp, ChevronDown } from '@/components/ui/icons';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'models',
    question: 'What is DeepChat and which AI capabilities are included?',
    answer:
      'DeepChat is an agentic AI workspace built for deep reasoning, software engineering, live web research, and GPT Image 2.6 generation in one unified interface.',
  },
  {
    id: 'privacy',
    question: 'How does DeepChat handle my privacy and chat history?',
    answer:
      'Your conversations, custom instructions, and memory stay scoped to your workspace session. You stay in control of what is saved, shared, or cleared at any time.',
  },
  {
    id: 'plans',
    question: 'Do I need a paid plan to get started?',
    answer:
      'No. You can start on the Free plan right away with standard usage limits, core chat, web search, and local history, then upgrade to Supporters or Cools anytime.',
  },
  {
    id: 'workflows',
    question: 'Can I use DeepChat for coding, files, and visual creation?',
    answer:
      'Yes. DeepChat supports multi-step code analysis, document uploads, structured artifacts, and high-resolution image generation directly inside your chat thread.',
  },
];

interface PlanetFaqSectionProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onScrollToTop: () => void;
}

export default function PlanetFaqSection({
  scrollContainerRef,
  onScrollToTop,
}: PlanetFaqSectionProps) {
  const stageRef = useRef<HTMLElement | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    container: scrollContainerRef,
    target: stageRef,
    offset: ['start end', 'end end'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    mass: 0.45,
  });

  // Empty scroll first (0 -> 0.22), then planet grows from tiny (0.03) to full (1.08)
  const planetScale = useTransform(
    smoothProgress,
    [0, 0.2, 0.48, 0.76, 1],
    [0.025, 0.08, 0.46, 1.05, 1.12]
  );
  const planetOpacity = useTransform(smoothProgress, [0, 0.14, 0.35, 1], [0.15, 0.7, 1, 1]);

  // Outer atmospheric halo expands slightly wider
  const atmosphereScale = useTransform(
    smoothProgress,
    [0, 0.22, 0.55, 0.82, 1],
    [0.04, 0.14, 0.65, 1.35, 1.45]
  );
  const atmosphereOpacity = useTransform(smoothProgress, [0, 0.18, 0.5, 1], [0, 0.45, 0.9, 1]);

  // Subtle orbital ring rotation
  const ringRotate = useTransform(smoothProgress, [0, 1], [-22, 14]);
  const ringOpacity = useTransform(smoothProgress, [0.15, 0.45, 0.85, 1], [0, 0.65, 0.35, 0.25]);

  // FAQ content emerges once the planet reaches full atmospheric scale
  const faqOpacity = useTransform(smoothProgress, [0.58, 0.78, 1], [0, 1, 1]);
  const faqY = useTransform(smoothProgress, [0.58, 0.8, 1], [48, 0, 0]);
  const faqScale = useTransform(smoothProgress, [0.58, 0.8, 1], [0.92, 1, 1]);

  return (
    <section
      ref={stageRef}
      id="faq-planet-stage"
      aria-label="Frequently Asked Questions"
      className={prefersReducedMotion ? 'relative py-20' : 'relative h-[260vh]'}
    >
      <div
        className={
          prefersReducedMotion
            ? 'relative mx-auto flex min-h-dvh w-full items-center justify-center overflow-hidden px-6 py-12'
            : 'sticky top-0 flex h-dvh w-full items-center justify-center overflow-hidden px-4 sm:px-6'
        }
      >
        {/* Outer Atmospheric Corona */}
        <motion.div
          aria-hidden="true"
          style={
            prefersReducedMotion
              ? undefined
              : { scale: atmosphereScale, opacity: atmosphereOpacity }
          }
          className="pointer-events-none absolute h-[min(125vw,1080px)] w-[min(125vw,1080px)] rounded-full"
        >
          <div
            className="h-full w-full rounded-full blur-3xl"
            style={{
              background:
                'radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--deepchat-accent) 28%, transparent) 0%, rgba(56, 189, 248, 0.14) 38%, rgba(168, 85, 247, 0.08) 62%, transparent 76%)',
            }}
          />
        </motion.div>

        {/* Orbital Atmosphere Ring */}
        <motion.div
          aria-hidden="true"
          style={
            prefersReducedMotion
              ? undefined
              : {
                  scale: planetScale,
                  rotate: ringRotate,
                  opacity: ringOpacity,
                }
          }
          className="pointer-events-none absolute h-[min(110vw,940px)] w-[min(110vw,940px)] rounded-full border border-[var(--deepchat-accent)]/25"
        />

        {/* Main Planetary Sphere */}
        <motion.div
          aria-hidden="true"
          style={
            prefersReducedMotion
              ? undefined
              : { scale: planetScale, opacity: planetOpacity }
          }
          className="pointer-events-none absolute h-[min(118vw,980px)] w-[min(118vw,980px)] rounded-full border border-[var(--dc-border)]/70 shadow-[0_0_120px_rgba(79,70,229,0.18),inset_0_24px_80px_rgba(129,140,248,0.18)]"
        >
          <div
            className="h-full w-full rounded-full"
            style={{
              background:
                'radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--deepchat-accent) 18%, var(--dc-panel)) 0%, var(--dc-panel) 54%, var(--dc-canvas) 100%)',
            }}
          />
        </motion.div>

        {/* FAQ Content Inside the Expanded Planet */}
        <motion.div
          style={
            prefersReducedMotion
              ? undefined
              : { opacity: faqOpacity, y: faqY, scale: faqScale }
          }
          className="relative z-10 mx-auto w-full max-w-2xl"
        >
          <div className="mb-7 text-center">
            <span className="inline-flex items-center rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)]/80 px-3 py-1 text-[11px] font-semibold tracking-wider text-[var(--deepchat-accent-text)] uppercase backdrop-blur-md">
              FAQ
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--dc-text-strong)] sm:text-4xl">
              Questions, answered
            </h2>
            <p className="mt-2 text-sm text-[var(--dc-text-muted)] sm:text-base">
              Everything you need to know before stepping into DeepChat.
            </p>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openIndex === index;
              const panelId = `faq-panel-${item.id}`;
              const buttonId = `faq-button-${item.id}`;

              return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-panel)]/90 shadow-sm backdrop-blur-xl transition-colors"
                >
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--dc-surface-hover)]/60"
                  >
                    <span className="text-sm font-semibold text-[var(--dc-text-strong)] sm:text-[15px]">
                      {item.question}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-[var(--dc-text-muted)] transition-transform duration-300 ${
                        isOpen ? 'rotate-180 text-[var(--deepchat-accent-text)]' : ''
                      }`}
                    />
                  </button>

                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    className={`grid transition-all duration-300 ease-out ${
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="border-t border-[var(--dc-border-subtle)] px-5 py-3.5 text-sm leading-relaxed text-[var(--dc-text-muted)]">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-7 flex justify-center">
            <button
              type="button"
              onClick={onScrollToTop}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)]/85 px-4 py-2 text-xs font-medium text-[var(--dc-text-strong)] backdrop-blur-md transition-colors hover:bg-[var(--dc-surface-hover)]"
            >
              <ArrowUp className="h-3.5 w-3.5" />
              <span>Back to sign in</span>
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
