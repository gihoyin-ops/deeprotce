'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  align?: 'left' | 'right';
  ariaLabel?: string;
}

interface MenuPosition {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  maxHeight: number;
  openUpward: boolean;
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
  align = 'right',
  ariaLabel
}: PillDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const desiredHeight = Math.min(264, options.length * 42 + 16);
    const openUpward = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
    const availableSpace = openUpward ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(140, Math.min(264, availableSpace - 16));

    setMenuPos({
      top: openUpward ? undefined : rect.bottom + 8,
      bottom: openUpward ? window.innerHeight - rect.top + 8 : undefined,
      left: align === 'left' ? Math.max(8, rect.left) : undefined,
      right: align === 'right' ? Math.max(8, window.innerWidth - rect.right) : undefined,
      maxHeight,
      openUpward
    });
  }, [align, options.length]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const handleReposition = () => updatePosition();

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, updatePosition]);

  const selected = useMemo(() => {
    const match = options.find(opt => opt.value === value);
    if (match) return match;
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      return { label: value.toUpperCase(), value, swatch: value };
    }
    return { label: value, value, swatch: undefined };
  }, [options, value]);

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
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

      {isOpen && menuPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          style={{
            position: 'fixed',
            top: menuPos.top,
            bottom: menuPos.bottom,
            left: menuPos.left,
            right: menuPos.right,
            zIndex: 500
          }}
          className={`min-w-[220px] overflow-hidden rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-1.5 shadow-xl shadow-black/15 dark:shadow-black/60 ${
            menuPos.openUpward ? 'origin-bottom' : 'origin-top'
          }`}
        >
          <div
            style={{ maxHeight: menuPos.maxHeight }}
            className="space-y-0.5 overflow-y-auto custom-scrollbar"
          >
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
        </div>,
        document.body
      )}
    </div>
  );
}
