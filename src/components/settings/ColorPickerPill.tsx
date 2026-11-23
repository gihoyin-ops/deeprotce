'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ColorPickerPillProps {
  value: string;
  fallbackHex: string;
  onChange: (hex: string) => void;
  onReset: () => void;
  ariaLabel: string;
}

interface HSV {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function hexToHsv(hex: string): HSV {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  return { h, s, v };
}

function hsvToHex(h: number, s: number, v: number): string {
  const sn = s / 100;
  const vn = v / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vn - c;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h >= 0 && h < 60) [r1, g1, b1] = [c, x, 0];
  else if (h < 120) [r1, g1, b1] = [x, c, 0];
  else if (h < 180) [r1, g1, b1] = [0, c, x];
  else if (h < 240) [r1, g1, b1] = [0, x, c];
  else if (h < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

export function ColorPickerPill({
  value,
  fallbackHex,
  onChange,
  onReset,
  ariaLabel
}: ColorPickerPillProps) {
  const isCustom = value !== 'default' && /^#[0-9a-fA-F]{6}$/.test(value);
  const resolvedHex = (isCustom ? value : fallbackHex).toLowerCase();
  const displayHex = resolvedHex.toUpperCase();

  const [isOpen, setIsOpen] = useState(false);
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(resolvedHex));
  const [popoverPos, setPopoverPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Sync HSV when external value changes while closed
  useEffect(() => {
    if (!isOpen) {
      setHsv(hexToHsv(resolvedHex));
    }
  }, [resolvedHex, isOpen]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverHeight = 232;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = spaceBelow < popoverHeight && spaceAbove > spaceBelow;

    setPopoverPos({
      top: openUpward ? undefined : rect.bottom + 8,
      bottom: openUpward ? window.innerHeight - rect.top + 8 : undefined,
      right: Math.max(8, window.innerWidth - rect.right)
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
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

  const handleSvPointer = (clientX: number, clientY: number, currentHue: number) => {
    if (!svRef.current) return;
    const rect = svRef.current.getBoundingClientRect();
    const s = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const v = clamp((1 - (clientY - rect.top) / rect.height) * 100, 0, 100);
    const next = { h: currentHue, s, v };
    setHsv(next);
    onChange(hsvToHex(next.h, next.s, next.v));
  };

  const startSvDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const currentHue = hsv.h;
    handleSvPointer(event.clientX, event.clientY, currentHue);

    const onMove = (e: PointerEvent) => handleSvPointer(e.clientX, e.clientY, currentHue);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleHuePointer = (clientX: number, currentS: number, currentV: number) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const h = clamp(((clientX - rect.left) / rect.width) * 360, 0, 360);
    const next = { h, s: currentS, v: currentV };
    setHsv(next);
    onChange(hsvToHex(next.h, next.s, next.v));
  };

  const startHueDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const { s, v } = hsv;
    handleHuePointer(event.clientX, s, v);

    const onMove = (e: PointerEvent) => handleHuePointer(e.clientX, s, v);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const pureHueHex = hsvToHex(hsv.h, 100, 100);

  return (
    <div className="flex shrink-0 items-center gap-2">
      {isCustom && (
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-medium text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)]"
        >
          Reset
        </button>
      )}
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(prev => !prev)}
        className={`inline-flex h-9 items-center gap-2.5 rounded-full border px-3.5 text-sm font-medium transition-colors ${
          isOpen
            ? 'border-[var(--dc-border-strong)] bg-[var(--dc-surface-hover)] text-[var(--dc-text-strong)]'
            : 'border-[var(--dc-border)] bg-[var(--dc-surface)] text-[var(--dc-text-strong)] hover:bg-[var(--dc-surface-hover)]'
        }`}
      >
        <span
          className="inline-block h-4 w-4 shrink-0 rounded-full border border-black/15 dark:border-white/20"
          style={{ backgroundColor: displayHex }}
          aria-hidden="true"
        />
        <span className="font-mono text-xs tracking-wide">{displayHex}</span>
      </button>

      {isOpen && popoverPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={ariaLabel}
          style={{
            position: 'fixed',
            top: popoverPos.top,
            bottom: popoverPos.bottom,
            right: popoverPos.right,
            zIndex: 520
          }}
          className="w-[236px] select-none overflow-hidden rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-1.5 shadow-2xl shadow-black/20 dark:shadow-black/65"
        >
          {/* 2D Saturation / Brightness canvas */}
          <div
            ref={svRef}
            onPointerDown={startSvDrag}
            style={{ backgroundColor: pureHueHex }}
            className="relative h-[176px] w-full cursor-crosshair overflow-hidden rounded-t-xl touch-none"
          >
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to right, #ffffff, transparent)' }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, #000000, transparent)' }}
            />
            <span
              className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.45)]"
              style={{
                left: `${hsv.s}%`,
                top: `${100 - hsv.v}%`,
                backgroundColor: displayHex
              }}
            />
          </div>

          {/* Hue spectrum bar */}
          <div
            ref={hueRef}
            onPointerDown={startHueDrag}
            style={{
              background:
                'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)'
            }}
            className="relative h-6 w-full cursor-ew-resize overflow-hidden rounded-b-xl touch-none"
          >
            <span
              className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.45)]"
              style={{
                left: `${(hsv.h / 360) * 100}%`,
                backgroundColor: pureHueHex
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
