'use client';

import React from 'react';
import { RefreshCw } from '@/components/ui/icons';
import { formatStorageSize } from '../helpers';
import type { StorageState } from '../types';

interface StorageTabProps {
  storage: StorageState;
  onRefresh: () => void;
}

// browser storage estimate
export function StorageTab({ storage, onRefresh }: StorageTabProps) {
  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight text-[var(--dc-text-strong)]">Storage</h3>
          <p className="mt-1 text-sm text-[var(--dc-text-muted)]">
            Review browser storage used by DeepChat on this device
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--dc-fill)] px-4 py-1.5 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill-hover)]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </button>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Used', value: formatStorageSize(storage.usage) },
          { label: 'Available quota', value: formatStorageSize(storage.quota) },
          { label: 'Local keys', value: String(storage.localItems) }
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] p-4"
          >
            <p className="text-xs font-medium text-[var(--dc-text-muted)]">{stat.label}</p>
            <p className="mt-1.5 text-xl font-semibold text-[var(--dc-text-strong)]">{stat.value}</p>
          </div>
        ))}
      </div>

      <section>
        <h4 className="border-b border-[var(--dc-border-subtle)] pb-3 text-base font-medium text-[var(--dc-text-strong)]">
          Device storage details
        </h4>
        <div className="py-4">
          <p className="text-sm font-medium text-[var(--dc-text-strong)]">Local browser cache &amp; IndexedDB</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--dc-text-muted)]">
            Storage includes local conversations, drafts, settings preferences, saved memories, notification inbox items, and media cache. Use Data controls to export or clear conversations.
          </p>
        </div>
      </section>
    </div>
  );
}
