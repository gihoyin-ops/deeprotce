'use client';

import { useEffect, useRef, useState } from 'react';

const PROBE_URL = '/api/online';
const PROBE_TIMEOUT_MS = 6000;
const POLL_INTERVAL_MS = 30000;
// If navigator.onLine says true, make the probe fail twice in a row before calling it
// offline (flaky VPNs drop a single probe all the time); if the browser already admits
// it's offline, one failed probe is enough to call it dead
const FAILURES_REQUIRED_WHEN_NAV_ONLINE = 2;
const FAILURES_REQUIRED_WHEN_NAV_OFFLINE = 1;

type Connectivity = 'online' | 'offline' | 'unknown';

const probeReachable = async (): Promise<boolean> => {
  try {
    // Any HTTP status means we reached the server, so we're online;
    // only a network TypeError (no route / TCP refused / DNS shit) counts as offline.
    // cache: 'no-store' stops the browser from serving a stale cached 200 when disconnected
    await fetch(PROBE_URL, {
      cache: 'no-store',
      method: 'GET',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    });
    return true;
  } catch {
    return false;
  }
};

const OfflineGuard = () => {
  const [state, setState] = useState<Connectivity>('unknown');
  const failuresRef = useRef(0);
  // Direct probe retry for the "Check connection" button; a full page reload here
  // looks like the app crashed, so just re-run the probe check instead
  const recheckRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;

    const runProbe = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        if (disposed) return;
        const navOnline = navigator.onLine !== false;
        const reachable = await probeReachable();
        if (disposed) return;
        if (reachable) {
          failuresRef.current = 0;
          setState((prev) => (prev === 'online' ? prev : 'online'));
          return;
        }
        failuresRef.current += 1;
        const required = navOnline ? FAILURES_REQUIRED_WHEN_NAV_ONLINE : FAILURES_REQUIRED_WHEN_NAV_OFFLINE;
        if (failuresRef.current >= required || !navOnline) {
          failuresRef.current = 0;
          setState((prev) => (prev === 'offline' ? prev : 'offline'));
        }
      }, 0);
    };

    // online/offline events spam like crazy during VPN drops or wifi roaming,
    // so debounce this probe check before firing
    let eventDebounce: number | undefined;
    const handleNetEvent = () => {
      window.clearTimeout(eventDebounce);
      eventDebounce = window.setTimeout(runProbe, 800);
    };

    void runProbe();
    recheckRef.current = runProbe;
    const interval = window.setInterval(runProbe, POLL_INTERVAL_MS);
    window.addEventListener('online', handleNetEvent);
    window.addEventListener('offline', handleNetEvent);

    return () => {
      disposed = true;
      recheckRef.current = () => undefined;
      window.clearTimeout(timer);
      window.clearTimeout(eventDebounce);
      window.clearInterval(interval);
      window.removeEventListener('online', handleNetEvent);
      window.removeEventListener('offline', handleNetEvent);
    };
  }, []);

  if (state !== 'offline') {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '1rem',
        right: '1rem',
        bottom: '1rem',
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      <style>{`
        .og-btn {
          min-height: 44px;
          min-width: 132px;
          padding: 0 0.875rem;
          font: 600 0.875rem/1.5 Arial, Helvetica, sans-serif;
          border-radius: 0.5rem;
          border: 1px solid rgba(255, 255, 255, 0.25);
          background: transparent;
          color: inherit;
          cursor: pointer;
          transition: background-color 0.15s ease, transform 0.1s ease;
          flex-shrink: 0;
        }
        .og-btn:hover { background: rgba(255, 255, 255, 0.12); }
        .og-btn:focus-visible {
          outline: 2px solid var(--deepchat-accent, #4f46e5);
          outline-offset: 2px;
        }
        .og-btn:active { transform: scale(0.98); }
      `}</style>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          borderRadius: '0.75rem',
          padding: '0.75rem 1rem',
          background: 'var(--foreground, #171717)',
          color: 'var(--background, #ffffff)',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -4px rgba(0, 0, 0, 0.15)',
          pointerEvents: 'auto',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '3px',
            width: '18px',
            height: '16px',
            flexShrink: 0,
          }}
        >
          <span style={{ display: 'block', height: '2px', borderRadius: '2px', background: 'currentColor', opacity: 0.4 }} />
          <span style={{ display: 'block', height: '2px', borderRadius: '2px', background: 'currentColor', opacity: 0.7 }} />
          <span style={{ display: 'block', height: '2px', borderRadius: '2px', background: 'currentColor' }} />
        </span>
        <p
          style={{
            margin: 0,
            flex: 1,
            minWidth: 0,
            font: '500 0.875rem/1.4 Arial, Helvetica, sans-serif',
          }}
        >
          You are offline, friend. Nothing is lost, we will pick up right where you left off when the connection returns.
        </p>
        <button
          type="button"
          className="og-btn"
          onClick={() => recheckRef.current()}
        >
          Check connection
        </button>
      </div>
    </div>
  );
};

export default OfflineGuard;
