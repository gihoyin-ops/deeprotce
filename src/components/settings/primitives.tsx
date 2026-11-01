'use client';

import React from 'react';
import ToggleSwitch from '@/components/ui/ToggleSwitch';

// shared settings layout primitives

export function TabHeader({ title, description }: { title: string; description: string }) {
  return (
    <header>
      <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
    </header>
  );
}

export function SettingsPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700/60 dark:bg-slate-900/40 sm:p-4 ${className}`}>
      {children}
    </div>
  );
}

// row with label and control
export function SettingRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60 sm:flex sm:items-center sm:justify-between sm:gap-6">
      <div className="mb-3 min-w-0 sm:mb-0">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="sm:w-80">{children}</div>
    </div>
  );
}

// switch card
export function ToggleRow({ title, description, checked, onChange, disabled = false }: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}

// icon toggle row
export function IconToggleRow({ icon, title, description, checked, onChange, disabled = false }: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          {icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</p>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}

export function ChannelToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-full border px-3 py-1.5 text-[11px] font-extrabold transition-colors ${checked
        ? 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300'
        : 'border-slate-200 bg-white text-slate-400 hover:text-slate-600 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-500 dark:hover:text-slate-300'}`}
    >
      {label}
    </button>
  );
}

export function StatusPill({ tone, children }: { tone: 'success' | 'muted' | 'info'; children: React.ReactNode }) {
  const tones = {
    success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
    muted: 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-400',
    info: 'bg-sky-50 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300'
  };
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${tones[tone]}`}>{children}</span>;
}

// primary save button
export function PrimaryButton({ children, onClick, disabled = false, loading = false, icon, className = '' }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-indigo-500 dark:hover:bg-indigo-400 ${className}`}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-hidden="true" />;
}
