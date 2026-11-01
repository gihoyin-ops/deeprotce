'use client';

import React from 'react';
import { Archive, RefreshCw } from '@/components/ui/icons';
import { formatStorageSize } from '../helpers';
import { TabHeader } from '../primitives';
import type { StorageState } from '../types';

interface StorageTabProps {
  storage: StorageState;
  onRefresh: () => void;
}

const statCard = 'rounded-2xl border border-slate-100 bg-slate-50 p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/40';

// browser storage estimate
export function StorageTab({ storage, onRefresh }: StorageTabProps) {
  return (
    <div className="space-y-8">
      <TabHeader title="Storage" description="Review browser storage used by DeepChat on this device." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Used', value: formatStorageSize(storage.usage) },
          { label: 'Available quota', value: formatStorageSize(storage.quota) },
          { label: 'Local keys', value: String(storage.localItems) }
        ].map(stat => (
          <div key={stat.label} className={statCard}>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700/60 dark:bg-slate-900/40 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-extrabold text-slate-800 dark:text-slate-100">Device storage snapshot</p>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              Usage can include drafts, preferences, notification inbox items, generated media cache, and browser-managed app data.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300 sm:w-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-900/60">
          <div className="flex items-start gap-3">
            <Archive className="mt-0.5 h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" />
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Data controls stay separate</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">Use Data control for exports, archived chats, shared links, and destructive cleanup actions.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
