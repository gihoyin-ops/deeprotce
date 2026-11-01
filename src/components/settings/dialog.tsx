'use client';

import React from 'react';
import { X } from '@/components/ui/icons';

// modal frame with backdrop and animations
export function Dialog({ open, closing, zIndex, width = 'max-w-4xl', onClose, children }: {
  open: boolean;
  closing: boolean;
  zIndex: number;
  width?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-slate-900/80 p-4`}
      style={{ zIndex, animation: `${closing ? 'settingsBackdropOut' : 'settingsBackdropIn'} 150ms ease-out both` }}
      onClick={event => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`flex max-h-[88dvh] w-full ${width} flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700/60 dark:bg-slate-900 dark:shadow-black/40`}
        style={{ animation: `${closing ? 'settingsPanelOut' : 'settingsPanelIn'} 180ms ease-out both` }}
        onClick={event => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ title, description, onClose, icon }: {
  title: string;
  description?: string;
  onClose: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4 dark:border-slate-700/60 sm:p-6">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-xl font-extrabold text-slate-900 dark:text-slate-100">{title}</h3>
          {description && <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">{description}</p>}
        </div>
      </div>
      <button
        onClick={onClose}
        className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        aria-label="Close dialog"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

export const dialogBody = 'flex-1 overflow-y-auto p-4 custom-scrollbar sm:p-6';
