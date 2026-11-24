'use client';

import DeepChatWordmarkSvg from '@/components/brand/DeepChatWordmarkSvg';

type ErrorPageProps = {
  kind: '404' | '500' | 'offline' | 'server' | 'naughty';
  title: string;
  lines: string[];
  primary?: { label: string; action: () => void };
  secondary?: { label: string; action: () => void };
};

const BADGE: Record<ErrorPageProps['kind'], string> = {
  '404': '404 · Not Found',
  '500': '500 · Server Error',
  offline: 'Offline · No Connection',
  server: '503 · Unavailable',
  naughty: '403 · Direct Access',
};

const FOOTER: Record<ErrorPageProps['kind'], string> = {
  '404': 'Your data is safe — we are just taking a breather.',
  '500': 'Your data is safe — we are just taking a breather.',
  offline: 'Nothing is lost — we pick up when the Wi-Fi comes back.',
  server: 'Your data is safe — we are just taking a breather.',
  naughty: 'No hard feelings, we promise.',
};

// Self-contained error & restricted-route surface styled with DeepChat theme tokens
// so it renders consistently even in global-error / global-not-found without globals.css.
const ErrorPage = ({ kind, title, lines, primary, secondary }: ErrorPageProps) => {
  const isNaughty = kind === 'naughty';
  const isOffline = kind === 'offline';
  const is404 = kind === '404';

  const bodyLines = lines.filter((line) => !line.startsWith('ref:') && !line.startsWith('poked:'));
  const codeLines = lines.filter((line) => line.startsWith('ref:') || line.startsWith('poked:'));

  return (
    <div className="ep-root" data-kind={kind}>
      <style>{`
        .ep-root {
          --ep-bg: var(--dc-canvas, var(--background, #ffffff));
          --ep-card: var(--dc-panel, #ffffff);
          --ep-surface: var(--dc-surface, #f8fafc);
          --ep-fill: var(--dc-fill, #f1f5f9);
          --ep-fill-hover: var(--dc-fill-hover, #e2e8f0);
          --ep-border: var(--dc-border, #e2e8f0);
          --ep-border-strong: var(--dc-border-strong, #cbd5e1);
          --ep-text-strong: var(--dc-text-strong, var(--foreground, #0f172a));
          --ep-text-body: var(--dc-text-body, #475569);
          --ep-text-muted: var(--dc-text-muted, #64748b);
          --ep-invert: var(--dc-invert, #0f172a);
          --ep-invert-hover: var(--dc-invert-hover, #1e293b);
          --ep-on-invert: var(--dc-text-on-invert, #ffffff);
          --ep-accent: var(--deepchat-accent, #2563eb);
          --ep-accent-soft: var(--deepchat-accent-soft, #eff6ff);
          --ep-accent-border: var(--deepchat-accent-border, #bfdbfe);
          --ep-accent-text: var(--deepchat-accent-text, #2563eb);
          --ep-shadow: 0 24px 60px -24px rgb(15 23 42 / 0.14), 0 4px 16px -4px rgb(15 23 42 / 0.06);

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
            radial-gradient(64% 46% at 50% 8%, color-mix(in srgb, var(--ep-accent) 7%, transparent), transparent 72%),
            radial-gradient(46% 36% at 84% 88%, color-mix(in srgb, var(--ep-accent) 4%, transparent), transparent 76%);
          color: var(--ep-text-strong);
        }

        html.dark .ep-root,
        html[data-appearance="dark"] .ep-root {
          --ep-bg: var(--dc-canvas, #0b0d11);
          --ep-card: var(--dc-panel, #12151b);
          --ep-surface: var(--dc-surface, #161920);
          --ep-fill: var(--dc-fill, #1f242e);
          --ep-fill-hover: var(--dc-fill-hover, #282e3b);
          --ep-border: var(--dc-border, #262b36);
          --ep-border-strong: var(--dc-border-strong, #363d4d);
          --ep-text-strong: var(--dc-text-strong, #f8fafc);
          --ep-text-body: var(--dc-text-body, #c4c9d4);
          --ep-text-muted: var(--dc-text-muted, #8d95a5);
          --ep-invert: var(--dc-invert, #f1f5f9);
          --ep-invert-hover: var(--dc-invert-hover, #ffffff);
          --ep-on-invert: var(--dc-text-on-invert, #0b0d11);
          --ep-shadow: 0 28px 72px -24px rgb(0 0 0 / 0.72), 0 0 0 1px rgb(255 255 255 / 0.03);
          background-image:
            radial-gradient(64% 46% at 50% 6%, color-mix(in srgb, var(--ep-accent) 13%, transparent), transparent 74%),
            radial-gradient(46% 36% at 84% 88%, rgb(255 255 255 / 0.025), transparent 76%);
        }

        .ep-root[data-kind="naughty"] {
          --ep-badge-dot: #f59e0b;
          --ep-badge-bg: rgb(245 158 11 / 0.1);
          --ep-badge-border: rgb(245 158 11 / 0.28);
          --ep-badge-text: #b45309;
        }
        html.dark .ep-root[data-kind="naughty"],
        html[data-appearance="dark"] .ep-root[data-kind="naughty"] {
          --ep-badge-bg: rgb(245 158 11 / 0.14);
          --ep-badge-border: rgb(245 158 11 / 0.3);
          --ep-badge-text: #fbbf24;
        }

        .ep-root *, .ep-root *::before, .ep-root *::after {
          box-sizing: border-box;
        }

        /* Subtle dot-grid backdrop */
        .ep-grid {
          pointer-events: none;
          position: absolute;
          inset: 0;
          background-image: radial-gradient(color-mix(in srgb, var(--ep-text-strong) 10%, transparent) 1px, transparent 1px);
          background-size: 24px 24px;
          mask-image: radial-gradient(ellipse 68% 58% at 50% 48%, black 18%, transparent 80%);
          -webkit-mask-image: radial-gradient(ellipse 68% 58% at 50% 48%, black 18%, transparent 80%);
          opacity: 0.45;
        }

        .ep-wrap {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 30rem;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .ep-brand {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          margin-bottom: 1.5rem;
        }
        .ep-brand-dot {
          width: 9px;
          height: 9px;
          border-radius: 9999px;
          background: radial-gradient(circle at 35% 35%, #60a5fa 0%, var(--ep-accent) 72%);
          box-shadow: 0 0 12px color-mix(in srgb, var(--ep-accent) 55%, transparent);
        }
        .ep-brand-word {
          height: 22px;
          width: auto;
          color: var(--ep-text-strong);
        }

        .ep-card {
          width: 100%;
          border-radius: 28px;
          border: 1px solid var(--ep-border);
          background: var(--ep-card);
          box-shadow: var(--ep-shadow);
          padding: 2.25rem 1.75rem 2rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        @media (min-width: 640px) {
          .ep-card {
            padding: 2.75rem 2.5rem 2.25rem;
          }
        }

        .ep-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.32rem 0.8rem;
          border-radius: 9999px;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          background: var(--ep-badge-bg, var(--ep-accent-soft));
          border: 1px solid var(--ep-badge-border, var(--ep-accent-border));
          color: var(--ep-badge-text, var(--ep-accent-text));
          margin-bottom: 1.5rem;
        }
        html.dark .ep-root:not([data-kind="naughty"]) .ep-badge,
        html[data-appearance="dark"] .ep-root:not([data-kind="naughty"]) .ep-badge {
          background: color-mix(in srgb, var(--ep-accent) 16%, transparent);
          border-color: color-mix(in srgb, var(--ep-accent) 34%, transparent);
          color: #93c5fd;
        }

        .ep-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: var(--ep-badge-dot, var(--ep-accent));
        }

        /* Mascot stage */
        .ep-stage {
          position: relative;
          width: 8.75rem;
          height: 8.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.5rem;
        }
        .ep-stage-halo {
          position: absolute;
          inset: 0.75rem;
          border-radius: 9999px;
          background: radial-gradient(circle, color-mix(in srgb, var(--ep-accent) 18%, transparent) 0%, transparent 72%);
          filter: blur(8px);
        }
        .ep-root[data-kind="naughty"] .ep-stage-halo {
          background: radial-gradient(circle, rgb(245 158 11 / 0.18) 0%, transparent 72%);
        }
        .ep-mascot {
          position: relative;
          width: 8.25rem;
          height: 8.25rem;
          overflow: visible;
        }
        .ep-mascot-body {
          transform-origin: 80px 92px;
        }
        .ep-bubble {
          fill: var(--ep-surface);
          stroke: var(--ep-border-strong);
          stroke-width: 3;
        }
        .ep-bubble-inner {
          fill: color-mix(in srgb, var(--ep-accent) 8%, transparent);
        }
        .ep-root[data-kind="naughty"] .ep-bubble-inner {
          fill: rgb(245 158 11 / 0.08);
        }
        .ep-antenna {
          stroke: var(--ep-border-strong);
          stroke-width: 3.2;
          stroke-linecap: round;
        }
        .ep-antenna-tip {
          fill: var(--ep-accent);
        }
        .ep-root[data-kind="naughty"] .ep-antenna-tip {
          fill: #f59e0b;
        }
        .ep-eye {
          fill: var(--ep-text-strong);
        }
        .ep-eye-wink {
          fill: none;
          stroke: var(--ep-text-strong);
          stroke-width: 3.4;
          stroke-linecap: round;
        }
        .ep-mouth {
          fill: none;
          stroke: var(--ep-text-strong);
          stroke-width: 3.4;
          stroke-linecap: round;
        }
        .ep-cheek {
          fill: var(--ep-accent);
          opacity: 0.16;
        }
        .ep-root[data-kind="naughty"] .ep-cheek {
          fill: #f59e0b;
          opacity: 0.22;
        }
        .ep-orbit {
          fill: none;
          stroke: color-mix(in srgb, var(--ep-accent) 28%, transparent);
          stroke-width: 1.5;
          stroke-dasharray: 5 5;
        }
        .ep-root[data-kind="naughty"] .ep-orbit {
          stroke: rgb(245 158 11 / 0.3);
        }
        .ep-shield-badge {
          fill: var(--ep-card);
          stroke: var(--ep-border-strong);
          stroke-width: 2.2;
        }
        .ep-shield-icon {
          fill: none;
          stroke: #f59e0b;
          stroke-width: 2.4;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .ep-title {
          margin: 0 0 0.7rem;
          font-size: 1.625rem;
          line-height: 1.2;
          font-weight: 750;
          letter-spacing: -0.03em;
          color: var(--ep-text-strong);
        }
        @media (min-width: 640px) {
          .ep-title {
            font-size: 1.875rem;
          }
        }

        .ep-copy {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-width: 24rem;
        }
        .ep-line {
          margin: 0;
          font-size: 0.95rem;
          line-height: 1.6;
          color: var(--ep-text-body);
          overflow-wrap: break-word;
        }

        .ep-code-wrap {
          margin-top: 1.1rem;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.45rem;
        }
        .ep-code-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.4rem 0.8rem;
          border-radius: 12px;
          border: 1px solid var(--ep-border);
          background: var(--ep-surface);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 0.78rem;
          line-height: 1.3;
          color: var(--ep-text-muted);
          max-width: 100%;
          overflow-wrap: anywhere;
        }
        .ep-code-pill strong {
          color: var(--ep-text-strong);
          font-weight: 600;
        }

        .ep-actions {
          margin-top: 1.75rem;
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
          min-height: 44px;
          padding: 0 1.4rem;
          border-radius: 9999px;
          font: 600 0.9rem/1 var(--font-sans, "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
          cursor: pointer;
          transition: background-color 150ms ease, border-color 150ms ease, transform 120ms ease, box-shadow 150ms ease;
        }
        .ep-btn:focus-visible {
          outline: 2px solid var(--ep-accent);
          outline-offset: 3px;
        }
        .ep-btn:active {
          transform: scale(0.97);
        }
        .ep-btn-primary {
          border: 1px solid transparent;
          background: var(--ep-invert);
          color: var(--ep-on-invert);
          box-shadow: 0 6px 18px -6px rgb(15 23 42 / 0.25);
        }
        .ep-btn-primary:hover {
          background: var(--ep-invert-hover);
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

        .ep-foot {
          margin: 1.25rem 0 0;
          font-size: 0.78rem;
          line-height: 1.4;
          color: var(--ep-text-muted);
          text-align: center;
        }

        @media (prefers-reduced-motion: no-preference) {
          .ep-badge-dot {
            animation: ep-pulse 2.2s ease-in-out infinite;
          }
          .ep-mascot-body {
            animation: ep-float 5.5s ease-in-out infinite;
          }
          .ep-root[data-kind="naughty"] .ep-mascot-body {
            animation: ep-tilt 4.8s ease-in-out infinite;
          }
          .ep-orbit {
            transform-origin: 80px 80px;
            animation: ep-spin 22s linear infinite;
          }
          @keyframes ep-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.45; transform: scale(0.82); }
          }
          @keyframes ep-float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-5px) rotate(1.5deg); }
          }
          @keyframes ep-tilt {
            0%, 100% { transform: translateY(0px) rotate(-4deg); }
            50% { transform: translateY(-4px) rotate(3deg); }
          }
          @keyframes ep-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        }
      `}</style>

      <div className="ep-grid" aria-hidden="true" />

      <div className="ep-wrap">
        <div className="ep-brand">
          <span className="ep-brand-dot" aria-hidden="true" />
          <DeepChatWordmarkSvg className="ep-brand-word" />
        </div>

        <main className="ep-card">
          <div className="ep-badge">
            <span className="ep-badge-dot" aria-hidden="true" />
            <span>{BADGE[kind]}</span>
          </div>

          <div className="ep-stage" aria-hidden="true">
            <div className="ep-stage-halo" />
            <svg className="ep-mascot" viewBox="0 0 160 160" focusable="false">
              <circle className="ep-orbit" cx="80" cy="80" r="64" />
              <g className="ep-mascot-body">
                <line className="ep-antenna" x1="80" y1="42" x2="80" y2="27" />
                <circle className="ep-antenna-tip" cx="80" cy="22" r="5.5" />
                <path
                  className="ep-bubble"
                  d="M46 42 H114 A18 18 0 0 1 132 60 V96 A18 18 0 0 1 114 114 H76 L50 135 L56 114 H46 A18 18 0 0 1 28 96 V60 A18 18 0 0 1 46 42 Z"
                />
                <rect className="ep-bubble-inner" x="35" y="49" width="90" height="58" rx="12" />
                <ellipse className="ep-cheek" cx="50" cy="86" rx="6.5" ry="4" />
                <ellipse className="ep-cheek" cx="110" cy="86" rx="6.5" ry="4" />

                {isNaughty ? (
                  <>
                    {/* Cheeky wink + smirk */}
                    <path className="ep-eye-wink" d="M55 73 Q62 67 69 73" />
                    <circle className="ep-eye" cx="98" cy="72" r="6" />
                    <path className="ep-mouth" d="M68 89 Q82 88 94 81" />
                  </>
                ) : is404 ? (
                  <>
                    {/* Curious eyes looking aside */}
                    <circle className="ep-eye" cx="64" cy="71" r="6" />
                    <circle className="ep-eye" cx="100" cy="71" r="6" />
                    <path className="ep-mouth" d="M72 88 Q80 84 88 88" />
                  </>
                ) : isOffline ? (
                  <>
                    {/* Sleepy / disconnected eyes */}
                    <path className="ep-eye-wink" d="M55 74 Q62 79 69 74" />
                    <path className="ep-eye-wink" d="M91 74 Q98 79 105 74" />
                    <path className="ep-mouth" d="M74 90 Q80 87 86 90" />
                  </>
                ) : (
                  <>
                    {/* Surprised / hiccup eyes */}
                    <path className="ep-eye-wink" d="M57 68 L67 77 M67 68 L57 77" />
                    <path className="ep-eye-wink" d="M93 68 L103 77 M103 68 L93 77" />
                    <path className="ep-mouth" d="M70 90 Q80 83 90 90" />
                  </>
                )}
              </g>

              {isNaughty && (
                <g transform="translate(106, 98)">
                  <circle className="ep-shield-badge" cx="16" cy="16" r="15" />
                  <rect className="ep-shield-icon" x="10.5" y="15" width="11" height="8.5" rx="2" />
                  <path className="ep-shield-icon" d="M12.5 15 V12.5 A3.5 3.5 0 0 1 19.5 12.5 V15" />
                </g>
              )}
            </svg>
          </div>

          <h1 className="ep-title">{title}</h1>

          <div className="ep-copy">
            {bodyLines.map((line, idx) => (
              <p key={idx} className="ep-line">
                {line}
              </p>
            ))}
          </div>

          {codeLines.length > 0 && (
            <div className="ep-code-wrap">
              {codeLines.map((line, idx) => {
                const sep = line.indexOf(':');
                const key = sep > -1 ? line.slice(0, sep) : '';
                const val = sep > -1 ? line.slice(sep + 1).trim() : line;
                return (
                  <code key={idx} className="ep-code-pill">
                    {key && <span>{key}:</span>}
                    <strong>{val}</strong>
                  </code>
                );
              })}
            </div>
          )}

          {(primary || secondary) && (
            <div className="ep-actions">
              {primary && (
                <button type="button" className="ep-btn ep-btn-primary" onClick={primary.action}>
                  {primary.label}
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

        <p className="ep-foot">{FOOTER[kind]}</p>
      </div>
    </div>
  );
};

export default ErrorPage;
