'use client';

import React from 'react';

export type TooltipShortcutTone = 'key' | 'muted' | 'icon';

export type TooltipShortcut = {
  label: React.ReactNode;
  tone?: TooltipShortcutTone;
};

type TooltipProps = {
  label: string;
  shortcuts?: TooltipShortcut[];
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'right';
  align?: 'start' | 'center' | 'end';
  disabled?: boolean;
};

const alignClass = {
  start: 'left-0 translate-x-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0 translate-x-0'
};

const sideClass = {
  top: 'bottom-full mb-2',
  bottom: 'top-full mt-2',
  right: 'left-full ml-2 top-1/2 -translate-y-1/2'
};

const shortcutClass = {
  key: 'rounded-full bg-white/[0.18] px-2 py-0.5 text-white/95',
  muted: 'rounded-full bg-white/[0.18] px-2 py-0.5 text-white/90',
  icon: 'text-white/85'
};

export default function Tooltip({ label, shortcuts = [], children, side = 'bottom', align = 'center', disabled = false }: TooltipProps) {
  const positionClass = side === 'right' ? sideClass.right : `${sideClass[side]} ${alignClass[align]}`;
  const visibleShortcuts = shortcuts.filter(shortcut => Boolean(shortcut.label));

  return (
    <span className="deepchat-tooltip group/tooltip relative inline-flex">
      {children}
      {!disabled && (
        <span
          className={`deepchat-tooltip-content pointer-events-none absolute z-[80] hidden max-w-[18rem] scale-95 whitespace-nowrap rounded-full bg-[#111214] px-3 py-1.5 text-[12px] font-semibold leading-none tracking-[-0.01em] text-white opacity-0 shadow-[0_6px_18px_-4px_rgba(0,0,0,0.32)] transition-all duration-150 ease-out group-hover/tooltip:scale-100 group-hover/tooltip:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:inline-flex ${positionClass}`}
        >
          <span className="inline-flex items-center gap-1.5">
            <span>{label}</span>
            {visibleShortcuts.length > 0 && (
              <span className="inline-flex items-center gap-1">
                {visibleShortcuts.map((shortcut, index) => (
                  <span key={index} className={`inline-flex items-center text-[11px] font-medium leading-none ${shortcutClass[shortcut.tone || 'key']}`}>
                    {shortcut.label}
                  </span>
                ))}
              </span>
            )}
          </span>
        </span>
      )}
    </span>
  );
}
