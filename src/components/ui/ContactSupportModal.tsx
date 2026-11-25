'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import toast from 'react-hot-toast';
import { X } from '@/components/ui/icons';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';

interface ContactSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactSupportModal({
  isOpen,
  onClose,
}: ContactSupportModalProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  useEffect(() => {
    const el = cardRef.current;
    if (!isOpen || !el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 12, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: 'power3.out', clearProps: 'transform' }
      );
    }, cardRef);
    return () => ctx.revert();
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedMessage = message.trim();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (trimmedMessage.length < 5) {
      toast.error('Please describe your issue (at least 5 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: trimmedEmail, message: trimmedMessage }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || 'Failed to send message.');
        return;
      }

      toast.success('Message sent to support@deepsia.my.id');
      setEmail('');
      setMessage('');
      onClose();
    } catch {
      toast.error('Network error while sending message.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[450] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Contact support"
        className="w-full max-w-md rounded-3xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--dc-text-strong)]">
              Contact support
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--dc-text-muted)]">
              Send your question or issue directly to{' '}
              <span className="font-medium text-[var(--dc-text-strong)]">
                support@deepsia.my.id
              </span>
              .
            </p>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            aria-label="Close contact support"
            className="rounded-full p-1.5 text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3" noValidate>
          <div>
            <label htmlFor="support-email" className="sr-only">
              Your email
            </label>
            <input
              id="support-email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="h-11 w-full rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-input)] px-3.5 text-sm text-[var(--dc-text-strong)] placeholder:text-[var(--dc-text-placeholder)] transition-colors focus:border-[var(--deepchat-accent)] focus:ring-2 focus:ring-[var(--deepchat-accent)]/20 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="support-message" className="sr-only">
              Message
            </label>
            <textarea
              id="support-message"
              name="message"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue or feedback..."
              className="custom-scrollbar w-full resize-none rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-input)] p-3.5 text-sm leading-relaxed text-[var(--dc-text-strong)] placeholder:text-[var(--dc-text-placeholder)] transition-colors focus:border-[var(--deepchat-accent)] focus:ring-2 focus:ring-[var(--deepchat-accent)]/20 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-medium text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-[var(--dc-invert)] px-4 py-2 text-sm font-medium text-[var(--dc-text-on-invert)] transition-colors hover:bg-[var(--dc-invert-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Sending...' : 'Send message'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
