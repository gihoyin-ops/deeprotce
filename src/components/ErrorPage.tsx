'use client';

import DeepChatLogoMark from '@/components/brand/DeepChatLogoMark';
import DeepChatWordmarkSvg from '@/components/brand/DeepChatWordmarkSvg';

type ErrorPageProps = {
  kind: '404' | '500' | 'offline' | 'server';
  title: string;
  lines: string[];
  primary?: { label: string; action: () => void };
  secondary?: { label: string; action: () => void };
};

// English-casual error surface with DeepChat branding; self-contained styles
// so it also renders inside global-error where globals.css is not loaded
const ErrorPage = ({ kind, title, lines, primary, secondary }: ErrorPageProps) => {
  return (
    <div className="errorpage-root" data-kind={kind}>
      <style>{`
        .errorpage-root {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          width: 100%;
          padding: 2.5rem 1.5rem;
          font-family: Arial, Helvetica, sans-serif;
          background: var(--background, #ffffff);
          color: var(--foreground, #171717);
        }
        @media (max-width: 768px) {
          .errorpage-root { padding-bottom: 9.5rem; }
        }
        .errorpage-root *, .errorpage-root *::before, .errorpage-root *::after { box-sizing: border-box; }
        .errorpage-inner {
          width: 100%;
          max-width: 28rem;
          margin: 0 auto;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* brand lockup */
        .ep-brand { display: flex; align-items: center; gap: 0.625rem; margin-bottom: 1.75rem; }
        .ep-brand .ep-brand-mark { width: 30px; height: 30px; color: var(--deepchat-accent, #4f46e5); flex-shrink: 0; }
        .ep-brand .ep-brand-word { height: 26px; width: auto; color: var(--foreground, #171717); }

        /* svg mascot: a small deepchat bubble with an antenna, drawn in theme vars */
        .ep-mascot { width: 10.5rem; max-width: 70vw; height: auto; margin-bottom: 1.9rem; }
        .ep-bubble { fill: var(--deepchat-accent-soft, #eef2ff); stroke: var(--deepchat-accent-border, #c7d2fe); stroke-width: 4; }
        .ep-antenna { stroke: var(--deepchat-accent-border, #c7d2fe); stroke-width: 4; stroke-linecap: round; }
        .ep-antenna-tip { fill: var(--deepchat-accent, #4f46e5); }
        .ep-eye { fill: var(--foreground, #171717); }
        html.dark .ep-eye,
        html[data-appearance="dark"] .ep-eye { fill: var(--deepchat-accent, #4f46e5); }
        .ep-cheek { fill: var(--deepchat-accent, #4f46e5); opacity: 0.18; }
        .ep-mouth { fill: none; stroke: var(--foreground, #171717); stroke-width: 4; stroke-linecap: round; }
        html.dark .ep-mouth,
        html[data-appearance="dark"] .ep-mouth { stroke: var(--deepchat-accent, #4f46e5); }
        .ep-shadow { fill: var(--deepchat-accent-soft, #eef2ff); stroke: var(--deepchat-accent-border, #c7d2fe); stroke-width: 2; opacity: 0.7; }
        .ep-mascot-anim { transform-origin: 50% 92%; }
        @media (prefers-reduced-motion: no-preference) {
          .ep-mascot-anim { animation: dc-mascot-wobble 8s ease-in-out infinite; }
          @keyframes dc-mascot-wobble {
            0%   { transform: rotate(-6deg) scaleY(1); }
            25%  { transform: rotate(-2deg) scaleY(1.03); }
            50%  { transform: rotate(5deg) scaleY(0.97); }
            75%  { transform: rotate(1deg) scaleY(1.01); }
            100% { transform: rotate(-6deg) scaleY(1); }
          }
        }

        .ep-title { margin: 0 0 1rem; font-size: 1.875rem; line-height: 2.25rem; font-weight: 700; letter-spacing: -0.025em; }
        .ep-line { margin: 0 auto 0.9rem; max-width: 26rem; font-size: 1rem; line-height: 1.625rem; opacity: 0.72; overflow-wrap: break-word; }
        .ep-line.code {
          margin: 0;
          font-family: "Courier New", Consolas, monospace;
          font-size: 0.75rem;
          line-height: 1rem;
          opacity: 0.5;
        }
        @media (min-width: 640px) {
          .ep-title { font-size: 2.25rem; line-height: 2.5rem; }
          .ep-line { font-size: 1.125rem; line-height: 1.75rem; }
        }

        .ep-actions { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; margin-top: 2rem; }
        .ep-btn {
          min-height: 44px;
          min-width: 160px;
          padding: 0 1.25rem;
          font: 600 1rem/1.5 Arial, Helvetica, sans-serif;
          border-radius: 0.5rem;
          border: 2px solid transparent;
          cursor: pointer;
          transition: background-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
        }
        .ep-btn:focus-visible { outline: 2px solid var(--deepchat-accent, #4f46e5); outline-offset: 3px; }
        .ep-btn:active { transform: scale(0.98); }
        .ep-btn.primary { background: var(--deepchat-accent, #4f46e5); color: #ffffff; }
        .ep-btn.primary:hover { background: var(--deepchat-accent-hover, #4338ca); }
        .ep-btn.secondary { background: transparent; color: var(--foreground, #171717); border-color: var(--deepchat-accent-border, #c7d2fe); }
        .ep-btn.secondary:hover { background: var(--deepchat-accent-soft, #eef2ff); }
        @media (min-width: 640px) {
          .ep-actions { flex-direction: row; justify-content: center; }
        }
        .ep-foot { margin-top: 2.5rem; font-size: 0.75rem; line-height: 1rem; opacity: 0.45; }
      `}</style>
      <div className="errorpage-inner">
        <div className="ep-brand">
          <DeepChatLogoMark className="ep-brand-mark" />
          <DeepChatWordmarkSvg className="ep-brand-word" />
        </div>
        <svg
          className="ep-mascot"
          viewBox="0 0 160 160"
          aria-hidden="true"
          focusable="false"
        >
          <g className="ep-mascot-anim">
            <line className="ep-antenna" x1="80" y1="44" x2="80" y2="30" />
            <circle className="ep-antenna-tip" cx="80" cy="25" r="6" />
            <path
              className="ep-bubble"
              d="M48 44 H112 A16 16 0 0 1 128 60 V96 A16 16 0 0 1 112 112 H76 L50 134 L56 112 H48 A16 16 0 0 1 32 96 V60 A16 16 0 0 1 48 44 Z"
            />
            <circle className="ep-eye" cx="62" cy="72" r="7" />
            <circle className="ep-eye" cx="98" cy="72" r="7" />
            <ellipse className="ep-cheek" cx="52" cy="84" rx="7" ry="4.5" />
            <ellipse className="ep-cheek" cx="108" cy="84" rx="7" ry="4.5" />
            <path className="ep-mouth" d="M70 86 Q80 95 90 86" />
          </g>
          <ellipse className="ep-shadow" cx="80" cy="148" rx="44" ry="8" />
        </svg>
        <h1 className="ep-title">{title}</h1>
        {lines.map((line, i) => (
          <p key={i} className={`ep-line${line.startsWith('ref:') ? ' code' : ''}`}>{line}</p>
        ))}
        {(primary || secondary) && (
          <div className="ep-actions">
            {primary && (
              <button type="button" className="ep-btn primary" onClick={primary.action}>
                {primary.label}
              </button>
            )}
            {secondary && (
              <button type="button" className="ep-btn secondary" onClick={secondary.action}>
                {secondary.label}
              </button>
            )}
          </div>
        )}
        <p className="ep-foot">DeepChat. Your data is safe, we are just taking a breather.</p>
      </div>
    </div>
  );
};

export default ErrorPage;
