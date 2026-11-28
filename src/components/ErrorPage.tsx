'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

type ErrorPageProps = {
  kind: '404' | '500' | 'offline' | 'server' | 'naughty';
  title: string;
  lines: string[];
  primary?: { label: string; action: () => void };
  secondary?: { label: string; action: () => void };
};

const StageIcon = ({ kind }: { kind: ErrorPageProps['kind'] }) => {
  if (kind === 'naughty') {
    return (
      <svg className="ep-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="11" y="21" width="26" height="18" rx="4" />
        <path d="M16 21v-5a8 8 0 0 1 16 0v5" />
        <circle cx="24" cy="30" r="2" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === '404') {
    return (
      <svg className="ep-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="24" cy="24" r="15" />
        <path d="M29.5 18.5l-3.6 7.4-7.4 3.6 3.6-7.4 7.4-3.6z" />
      </svg>
    );
  }
  if (kind === 'offline') {
    return (
      <svg className="ep-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 19a21 21 0 0 1 28 0" />
        <path d="M15.5 25a13 13 0 0 1 17 0" />
        <path d="M20.5 30.5a5.5 5.5 0 0 1 7 0" />
        <path d="M11 37L37 11" />
      </svg>
    );
  }
  return (
    <svg className="ep-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="24" cy="24" r="15" />
      <path d="M24 16v10" />
      <circle cx="24" cy="32" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
};

// Self-contained error and restricted-route page styled with Benthos theme tokens
// so this shit still renders properly in global-error / global-not-found without globals.css
const ErrorPage = ({ kind, title, lines, primary, secondary }: ErrorPageProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const emblemRef = useRef<HTMLDivElement>(null);

  const bodyLines = lines.filter((line) => !line.startsWith('ref:') && !line.startsWith('poked:'));

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo(
        '.ep-brand',
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, duration: 0.45 }
      )
        .fromTo(
          '.ep-card',
          { opacity: 0, y: 16, scale: 0.985 },
          { opacity: 1, y: 0, scale: 1, duration: 0.55 },
          '-=0.3'
        )
        .fromTo(
          '.ep-ring-outer, .ep-ring-inner',
          { opacity: 0, scale: 0.86 },
          { opacity: 1, scale: 1, duration: 0.6, stagger: 0.08, ease: 'power2.out' },
          '-=0.4'
        );

      const iconShapes = root.querySelectorAll<SVGGeometryElement>('.ep-icon path, .ep-icon rect, .ep-icon circle:not([fill="currentColor"])');
      iconShapes.forEach((shape) => {
        if (typeof shape.getTotalLength === 'function') {
          const length = shape.getTotalLength();
          gsap.set(shape, { strokeDasharray: length, strokeDashoffset: length });
        }
      });

      if (iconShapes.length > 0) {
        tl.to(
          iconShapes,
          {
            strokeDashoffset: 0,
            duration: 0.7,
            stagger: 0.08,
            ease: 'power2.inOut',
          },
          '-=0.45'
        );
      }

      tl.fromTo(
        '.ep-icon circle[fill="currentColor"]',
        { scale: 0, opacity: 0, transformOrigin: 'center center' },
        { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' },
        '-=0.3'
      )
        .fromTo(
          '.ep-stagger',
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.48, stagger: 0.07 },
          '-=0.3'
        );

      // Ambient bullshit micro-animations so the screen isn't dead ass still
      gsap.to('.ep-ring-outer', {
        rotation: 360,
        duration: 36,
        repeat: -1,
        ease: 'none',
        transformOrigin: 'center center',
      });

      gsap.to('.ep-emblem-float', {
        y: -3.5,
        duration: 2.8,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      gsap.to('.ep-stage-glow', {
        scale: 1.08,
        opacity: 0.85,
        duration: 3.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      // Subtle pointer parallax on the emblem and spotlight, nothing crazy
      const card = cardRef.current;
      const emblem = emblemRef.current;
      if (card && emblem) {
        const moveX = gsap.quickTo(emblem, 'x', { duration: 0.45, ease: 'power3.out' });
        const moveY = gsap.quickTo(emblem, 'y', { duration: 0.45, ease: 'power3.out' });

        const onMove = (e: PointerEvent) => {
          const rect = card.getBoundingClientRect();
          const rx = (e.clientX - rect.left) / rect.width - 0.5;
          const ry = (e.clientY - rect.top) / rect.height - 0.5;
          card.style.setProperty('--ep-mx', `${((rx + 0.5) * 100).toFixed(1)}%`);
          card.style.setProperty('--ep-my', `${((ry + 0.5) * 100).toFixed(1)}%`);
          moveX(rx * 10);
          moveY(ry * 10);
        };

        const onLeave = () => {
          moveX(0);
          moveY(0);
        };

        card.addEventListener('pointermove', onMove);
        card.addEventListener('pointerleave', onLeave);

        return () => {
          card.removeEventListener('pointermove', onMove);
          card.removeEventListener('pointerleave', onLeave);
        };
      }
    }, root);

    return () => ctx.revert();
  }, [kind]);

  return (
    <div ref={rootRef} className="ep-root" data-kind={kind}>
      <style>{`
        .ep-root {
          --ep-bg: var(--dc-canvas, var(--background, #ffffff));
          --ep-card: var(--dc-panel, #ffffff);
          --ep-surface: var(--dc-surface, #f8fafc);
          --ep-fill: var(--dc-fill, #f1f5f9);
          --ep-fill-hover: var(--dc-fill-hover, #e2e8f0);
          --ep-border: var(--dc-border, rgba(15, 23, 42, 0.08));
          --ep-border-strong: var(--dc-border-strong, rgba(15, 23, 42, 0.14));
          --ep-text-strong: var(--dc-text-strong, var(--foreground, #0a0a0a));
          --ep-text-body: var(--dc-text-body, #52525b);
          --ep-invert: var(--dc-invert, #0a0a0a);
          --ep-invert-hover: var(--dc-invert-hover, #27272a);
          --ep-on-invert: var(--dc-text-on-invert, #ffffff);
          --ep-accent: var(--deepchat-accent, #2563eb);
          --ep-shadow:
            0 24px 64px -28px rgba(0, 0, 0, 0.12),
            0 2px 10px -2px rgba(0, 0, 0, 0.04);

          position: relative;
          min-height: 100dvh;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 2rem 1.25rem;
          box-sizing: border-box;
          font-family: var(--font-sans, "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
          background-color: var(--ep-bg);
          background-image:
            radial-gradient(60% 42% at 50% 0%, color-mix(in srgb, var(--ep-accent) 6%, transparent), transparent 72%);
          color: var(--ep-text-strong);
          -webkit-font-smoothing: antialiased;
        }

        html.dark .ep-root,
        html[data-appearance="dark"] .ep-root {
          --ep-bg: var(--dc-canvas, #09090b);
          --ep-card: var(--dc-panel, #111114);
          --ep-surface: var(--dc-surface, #18181b);
          --ep-fill: var(--dc-fill, #1f1f24);
          --ep-fill-hover: var(--dc-fill-hover, #27272e);
          --ep-border: var(--dc-border, rgba(255, 255, 255, 0.08));
          --ep-border-strong: var(--dc-border-strong, rgba(255, 255, 255, 0.15));
          --ep-text-strong: var(--dc-text-strong, #fafafa);
          --ep-text-body: var(--dc-text-body, #a1a1aa);
          --ep-invert: var(--dc-invert, #fafafa);
          --ep-invert-hover: var(--dc-invert-hover, #e4e4e7);
          --ep-on-invert: var(--dc-text-on-invert, #09090b);
          --ep-shadow:
            0 32px 80px -28px rgba(0, 0, 0, 0.78),
            0 0 0 1px rgba(255, 255, 255, 0.04);
          background-image:
            radial-gradient(60% 42% at 50% 0%, color-mix(in srgb, var(--ep-accent) 12%, transparent), transparent 72%);
        }

        .ep-root[data-kind="naughty"] {
          --ep-accent: #f59e0b;
        }

        .ep-root *, .ep-root *::before, .ep-root *::after {
          box-sizing: border-box;
        }

        .ep-grid {
          pointer-events: none;
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(to right, color-mix(in srgb, var(--ep-text-strong) 4.5%, transparent) 1px, transparent 1px),
            linear-gradient(to bottom, color-mix(in srgb, var(--ep-text-strong) 4.5%, transparent) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 64% 56% at 50% 48%, black 12%, transparent 78%);
          -webkit-mask-image: radial-gradient(ellipse 64% 56% at 50% 48%, black 12%, transparent 78%);
        }

        .ep-wrap {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 28rem;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .ep-brand {
          margin-bottom: 1.5rem;
          font-size: 1.35rem;
          font-weight: 700;
          letter-spacing: -0.025em;
          line-height: 1.2;
          color: var(--ep-text-strong);
          user-select: none;
        }

        .ep-card {
          --ep-mx: 50%;
          --ep-my: 24%;
          position: relative;
          width: 100%;
          border-radius: 24px;
          border: 1px solid var(--ep-border);
          background: var(--ep-card);
          box-shadow: var(--ep-shadow);
          padding: 2.5rem 1.75rem 2.25rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          overflow: hidden;
        }
        .ep-card::before {
          content: '';
          pointer-events: none;
          position: absolute;
          inset: 0;
          background: radial-gradient(
            320px circle at var(--ep-mx) var(--ep-my),
            color-mix(in srgb, var(--ep-accent) 7%, transparent),
            transparent 70%
          );
          opacity: 0;
          transition: opacity 280ms ease;
        }
        .ep-card:hover::before {
          opacity: 1;
        }

        @media (min-width: 640px) {
          .ep-card {
            padding: 3rem 2.5rem 2.5rem;
          }
        }

        .ep-stage {
          position: relative;
          width: 7.5rem;
          height: 7.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.75rem;
        }
        .ep-stage-glow {
          position: absolute;
          inset: 0.75rem;
          border-radius: 9999px;
          background: radial-gradient(circle, color-mix(in srgb, var(--ep-accent) 18%, transparent) 0%, transparent 72%);
          filter: blur(12px);
        }
        .ep-ring-outer {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 1px dashed color-mix(in srgb, var(--ep-text-strong) 14%, transparent);
        }
        .ep-ring-inner {
          position: absolute;
          inset: 0.75rem;
          border-radius: 9999px;
          border: 1px solid var(--ep-border);
          background: var(--ep-surface);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }
        .ep-emblem-float {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ep-emblem-parallax {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ep-icon {
          width: 2.5rem;
          height: 2.5rem;
          color: var(--ep-text-strong);
        }

        .ep-title {
          position: relative;
          margin: 0 0 0.75rem;
          font-size: 1.5rem;
          line-height: 1.2;
          font-weight: 650;
          letter-spacing: -0.028em;
          color: var(--ep-text-strong);
        }
        @media (min-width: 640px) {
          .ep-title {
            font-size: 1.75rem;
          }
        }

        .ep-copy {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          max-width: 22rem;
        }
        .ep-line {
          margin: 0;
          font-size: 0.9375rem;
          line-height: 1.6;
          color: var(--ep-text-body);
          overflow-wrap: break-word;
        }

        .ep-actions {
          position: relative;
          margin-top: 1.85rem;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: center;
          gap: 0.65rem;
        }
        @media (min-width: 480px) {
          .ep-actions {
            flex-direction: row;
            align-items: center;
          }
        }

        .ep-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          min-height: 42px;
          padding: 0 1.35rem;
          border-radius: 9999px;
          font: 500 0.875rem/1 var(--font-sans, "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
          cursor: pointer;
          transition:
            background-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
            border-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
            transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
            box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ep-btn:focus-visible {
          outline: 2px solid var(--ep-accent);
          outline-offset: 3px;
        }
        .ep-btn:hover {
          transform: translateY(-1px);
        }
        .ep-btn:active {
          transform: scale(0.97);
        }
        .ep-btn-primary {
          border: 1px solid transparent;
          background: var(--ep-invert);
          color: var(--ep-on-invert);
          box-shadow: 0 6px 18px -6px rgba(0, 0, 0, 0.25);
        }
        .ep-btn-primary:hover {
          background: var(--ep-invert-hover);
        }
        .ep-btn-arrow {
          width: 14px;
          height: 14px;
          transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ep-btn-primary:hover .ep-btn-arrow {
          transform: translateX(2px);
        }
        .ep-btn-secondary {
          border: 1px solid var(--ep-border);
          background: var(--ep-fill);
          color: var(--ep-text-strong);
        }
        .ep-btn-secondary:hover {
          background: var(--ep-fill-hover);
          border-color: var(--ep-border-strong);
        }
      `}</style>

      <div className="ep-grid" aria-hidden="true" />

      <div className="ep-wrap">
        <div className="ep-brand">Benthos</div>

        <main ref={cardRef} className="ep-card">
          <div className="ep-stage" aria-hidden="true">
            <div className="ep-stage-glow" />
            <div className="ep-ring-outer" />
            <div className="ep-ring-inner" />
            <div className="ep-emblem-float">
              <div ref={emblemRef} className="ep-emblem-parallax">
                <StageIcon kind={kind} />
              </div>
            </div>
          </div>

          <h1 className="ep-title ep-stagger">{title}</h1>

          <div className="ep-copy ep-stagger">
            {bodyLines.map((line, idx) => (
              <p key={idx} className="ep-line">
                {line}
              </p>
            ))}
          </div>

          {(primary || secondary) && (
            <div className="ep-actions ep-stagger">
              {primary && (
                <button type="button" className="ep-btn ep-btn-primary" onClick={primary.action}>
                  <span>{primary.label}</span>
                  <svg className="ep-btn-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3.5 8h9M8.5 4l4 4-4 4" />
                  </svg>
                </button>
              )}
              {secondary && (
                <button type="button" className="ep-btn ep-btn-secondary" onClick={secondary.action}>
                  {secondary.label}
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ErrorPage;
