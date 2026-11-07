'use client';

import { useEffect, useState } from 'react';

const OfflineGuard = () => {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  useEffect(() => {
    const handleStatus = (event: Event) => {
      setIsOnline(event.type === 'online');
    };

    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);

    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  if (isOnline) {
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
            gap: '3px',
            flexShrink: 0,
          }}
        >
          <span style={{ width: '18px', height: 0, borderTop: '2px solid currentColor', borderRadius: '1px', opacity: 0.95 }} />
          <span style={{ width: '13px', height: 0, borderTop: '2px solid currentColor', borderRadius: '1px', opacity: 0.65 }} />
          <span style={{ width: '8px', height: 0, borderTop: '2px solid currentColor', borderRadius: '1px', opacity: 0.4 }} />
        </span>
        <p
          style={{
            margin: 0,
            flex: '1 1 auto',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '0.875rem',
            lineHeight: 1.4,
          }}
        >
          You are offline, friend. Nothing is lost, we will pick up right where you left off when the wifi returns.
        </p>
        <button
          type="button"
          className="og-btn"
          onClick={() => window.location.reload()}
          style={{
            flexShrink: 0,
            minHeight: '44px',
            minWidth: '92px',
            padding: '0.5rem 1rem',
            border: '1px solid rgba(128, 128, 128, 0.55)',
            borderRadius: '0.5rem',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '0.875rem',
            fontWeight: 600,
            transition: 'transform 0.1s ease',
          }}
        >
          Check connection
        </button>
      </div>
    </div>
  );
};

export default OfflineGuard;
