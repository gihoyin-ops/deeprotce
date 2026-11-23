'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from '@/components/ui/icons';

export interface PillDropdownOption {
  label: string;
  value: string;
  description?: string;
  swatch?: string;
}

interface PillDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: PillDropdownOption[];
  showSwatch?: boolean;
  allowCustomColor?: boolean;
  align?: 'left' | 'right';
  ariaLabel?: string;
}

function ColorDot({ swatch }: { swatch?: string }) {
  if (!swatch) return null;
  const isTransparent = swatch === 'transparent';
  return (
    <span
      className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-black/15 dark:border-white/20 ${
        isTransparent
          ? 'bg-gradient-to-br from-slate-200 via-white to-slate-300 dark:from-slate-700 dark:via-slate-800 dark:to-slate-600'
          : ''
      }`}
      style={isTransparent ? undefined : { backgroundColor: swatch }}
      aria-hidden="true"
    />
  );
}

export function PillDropdown({
  value,
  onChange,
  options,
  showSwatch = false,
  allowCustomColor = false,
  align = 'right',
  ariaLabel
}: PillDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen]);

  const selected = useMemo(() => {
    const match = options.find(opt => opt.value === value);
    if (match) return match;
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      return { label: value.toUpperCase(), value, swatch: value };
    }
    return { label: value, value, swatch: undefined };
  }, [options, value]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => setIsOpen(prev => !prev)}
        className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors ${
          isOpen
            ? 'border-[var(--dc-border-strong)] bg-[var(--dc-surface-hover)] text-[var(--dc-text-strong)]'
            : 'border-[var(--dc-border)] bg-[var(--dc-surface)] text-[var(--dc-text-strong)] hover:bg-[var(--dc-surface-hover)]'
        }`}
      >
        {showSwatch && <ColorDot swatch={selected.swatch} />}
        <span className="max-w-[160px] truncate">{selected.label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--dc-text-muted)] transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className={`absolute z-[320] mt-2 min-w-[220px] overflow-hidden rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-1.5 shadow-xl shadow-black/10 dark:shadow-black/50 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="max-h-64 space-y-0.5 overflow-y-auto custom-scrollbar">
            {options.map(option => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? 'bg-[var(--dc-fill)] font-semibold text-[var(--dc-text-strong)]'
                      : 'text-[var(--dc-text)] hover:bg-[var(--dc-surface-hover)]'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {showSwatch && <ColorDot swatch={option.swatch} />}
                    <div className="min-w-0">
                      <p className="truncate">{option.label}</p>
                      {option.description && (
                        <p className="truncate text-xs text-[var(--dc-text-muted)]">{option.description}</p>
                      )}
                    </div>
                  </div>
                  {active && <Check className="h-4 w-4 shrink-0 text-[var(--dc-text-strong)]" />}
                </button>
              );
            })}
          </div>

          {allowCustomColor && (
            <div className="mt-1 border-t border-[var(--dc-border-subtle)] pt-1.5">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-[var(--dc-text)] transition-colors hover:bg-[var(--dc-surface-hover)]">
                <span>Custom color…</span>
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffffff'}
                  onChange={event => onChange(event.target.value)}
                  className="h-6 w-8 cursor-pointer rounded border border-[var(--dc-border)] bg-transparent p-0"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
