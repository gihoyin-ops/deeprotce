'use client';

import React, { useRef, useState } from 'react';
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';

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
}

export default function PlanetFaqSection({
  scrollContainerRef,
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
    stiffness: 95,
    damping: 28,
    mass: 0.4,
  });

  // Empty scroll first (0 -> 0.22), then a circle emerges from the bottom and grows to full screen
  const circleRadius = useTransform(
    smoothProgress,
    [0, 0.2, 0.45, 0.78, 1],
    [0, 3, 28, 135, 155]
  );
  const circleY = useTransform(
    smoothProgress,
    [0, 0.22, 0.55, 0.85, 1],
    [104, 100, 82, 54, 50]
  );
  const clipPath = useMotionTemplate`circle(${circleRadius}% at 50% ${circleY}%)`;

  // FAQ content fades in cleanly once the circular surface fills the screen
  const faqOpacity = useTransform(smoothProgress, [0.58, 0.78, 1], [0, 1, 1]);
  const faqY = useTransform(smoothProgress, [0.58, 0.8, 1], [32, 0, 0]);

  return (
    <section
      ref={stageRef}
      id="faq-stage"
      aria-label="Frequently Asked Questions"
      className={prefersReducedMotion ? 'relative py-20' : 'relative h-[250vh]'}
    >
      <div
        className={
          prefersReducedMotion
            ? 'relative mx-auto flex min-h-dvh w-full items-center justify-center px-6 py-16'
            : 'sticky top-0 flex h-dvh w-full items-center justify-center overflow-hidden'
        }
      >
        {/* Full-screen circular atmospheric reveal from the bottom */}
        <motion.div
          style={
            prefersReducedMotion
              ? undefined
              : {
                  clipPath,
                  WebkitClipPath: clipPath,
                }
          }
          className="relative flex h-full w-full items-center justify-center px-6"
        >
          {/* Clean full-bleed atmospheric surface */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 90% at 50% 100%, color-mix(in srgb, var(--deepchat-accent) 12%, var(--dc-panel-muted)) 0%, var(--dc-panel-muted) 55%, var(--dc-canvas) 100%)',
            }}
          />

          {/* 4-Question FAQ */}
          <motion.div
            style={
              prefersReducedMotion
                ? undefined
                : { opacity: faqOpacity, y: faqY }
            }
            className="relative z-10 mx-auto w-full max-w-2xl"
          >
            <div className="mb-10 text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--dc-text-strong)] sm:text-4xl">
                Questions, answered
              </h2>
              <p className="mt-2.5 text-sm text-[var(--dc-text-muted)] sm:text-base">
                Everything you need to know before getting started with DeepChat.
              </p>
            </div>

            <div className="divide-y divide-[var(--dc-border-subtle)] border-y border-[var(--dc-border-subtle)]">
              {FAQ_ITEMS.map((item, index) => {
                const isOpen = openIndex === index;
                const panelId = `faq-panel-${item.id}`;
                const buttonId = `faq-button-${item.id}`;

                return (
                  <div key={item.id}>
                    <button
                      id={buttonId}
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                      className="flex w-full items-center justify-between gap-4 py-5 text-left transition-opacity hover:opacity-80"
                    >
                      <span className="text-sm font-medium text-[var(--dc-text-strong)] sm:text-base">
                        {item.question}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                          isOpen
                            ? 'border-[var(--dc-text-strong)] bg-[var(--dc-text-strong)] text-[var(--dc-text-on-invert)]'
                            : 'border-[var(--dc-border)] bg-[var(--dc-surface)] text-[var(--dc-text-muted)]'
                        }`}
                      >
                        <span className="absolute h-[1.5px] w-2.5 rounded-full bg-current transition-transform duration-300" />
                        <span
                          className={`absolute h-2.5 w-[1.5px] rounded-full bg-current transition-all duration-300 ${
                            isOpen ? 'scale-y-0 rotate-90 opacity-0' : 'scale-y-100 rotate-0 opacity-100'
                          }`}
                        />
                      </span>
                    </button>

                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      className={`grid transition-all duration-300 ease-out ${
                        isOpen ? 'grid-rows-[1fr] pb-5 opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="text-sm leading-relaxed text-[var(--dc-text-muted)]">
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
