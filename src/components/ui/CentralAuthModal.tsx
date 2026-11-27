'use client';

import React, { useEffect, useState } from 'react';
import { getAuthBaseUrl } from '@/lib/auth/auth-url';

interface CentralAuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CentralAuthModal({
  open,
  onClose,
  onSuccess,
}: CentralAuthModalProps) {
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setIframeSrc(null);
      return;
    }

    const authBase = getAuthBaseUrl();
    const redirect = encodeURIComponent(window.location.href);
    setIframeSrc(`${authBase}/login?embed=1&redirect=${redirect}`);

    const authOrigin = new URL(authBase).origin;
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== authOrigin) return;
      if (event.data && event.data.type === 'deepsia:auth-success') {
        onSuccess();
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, onSuccess]);

  if (!open || !iframeSrc) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to Deepsia"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative h-[min(640px,90dvh)] w-full max-w-[460px] overflow-hidden rounded-[24px] border border-[var(--dc-border)] bg-[var(--dc-canvas)] shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign in dialog"
          className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--dc-surface)] text-sm font-medium text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
        >
          ✕
        </button>
        <iframe
          src={iframeSrc}
          title="Sign in to Deepsia"
          className="h-full w-full border-0"
          allow="clipboard-write"
        />
      </div>
    </div>
  );
}
