'use client';

import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw, Trash2 } from '@/components/ui/icons';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import {
  GUEST_STORAGE_LIMIT_BYTES,
  listGuestLibraryData,
  runGuestLibraryAction
} from '@/lib/storage/guest-library';
import type { StorageState } from '../types';

interface StorageTabProps {
  storage: StorageState;
  onRefresh: () => void;
}

const AUTO_SPACE_KEY = 'deepchat-auto-space-storage';

const formatMb = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${mb.toFixed(1).replace(/\.0$/, '')} MB`;
};

export function StorageTab({ onRefresh }: StorageTabProps) {
  const [usedBytes, setUsedBytes] = useState(0);
  const [limitBytes, setLimitBytes] = useState(250 * 1024 * 1024);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [autoSpaceUp, setAutoSpaceUp] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(AUTO_SPACE_KEY);
    return saved === null ? true : saved === 'true';
  });

  const fetchCloudStorage = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/library', { credentials: 'same-origin' });
      const data = (await res.json().catch(() => ({}))) as {
        guest?: boolean;
        storage?: { usedBytes: number; limitBytes: number };
      };
      if (data.guest || res.status === 401) {
        setIsGuest(true);
        const guest = await listGuestLibraryData();
        setUsedBytes(guest.storage.usedBytes);
        setLimitBytes(GUEST_STORAGE_LIMIT_BYTES);
        return;
      }
      setIsGuest(false);
      if (data.storage) {
        setUsedBytes(data.storage.usedBytes);
        setLimitBytes(data.storage.limitBytes);
      }
    } catch {
      // keep existing values
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCloudStorage();
  }, [fetchCloudStorage]);

  const handleToggleAutoSpace = (next: boolean) => {
    setAutoSpaceUp(next);
    try {
      localStorage.setItem(AUTO_SPACE_KEY, String(next));
    } catch {}
  };

  const handleDeleteStorage = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      if (isGuest) {
        const guest = await listGuestLibraryData();
        const allIds = [...guest.items, ...guest.trashedItems].map(i => i.id);
        if (allIds.length > 0) {
          await runGuestLibraryAction({ action: 'deletePermanent', itemIds: allIds });
        }
      } else {
        const res = await fetch('/api/library', { credentials: 'same-origin' });
        const data = (await res.json().catch(() => ({}))) as {
          items?: Array<{ id: string }>;
          trashedItems?: Array<{ id: string }>;
        };
        const allIds = [...(data.items ?? []), ...(data.trashedItems ?? [])].map(i => i.id);
        if (allIds.length > 0) {
          await fetch('/api/library', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ action: 'deletePermanent', itemIds: allIds })
          });
        }
      }

      setConfirmDelete(false);
      await fetchCloudStorage();
      onRefresh();
      toast.success('Storage cleared');
    } catch {
      toast.error('Could not clear storage.');
    } finally {
      setIsDeleting(false);
    }
  };

  const percent = Math.min(100, Math.round((usedBytes / Math.max(1, limitBytes)) * 100));

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight text-[var(--dc-text-strong)]">
            Storage
          </h3>
          <p className="mt-1 text-sm text-[var(--dc-text-muted)]">
            Manage your DeepChat media storage
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onRefresh();
            void fetchCloudStorage();
          }}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--dc-fill)] px-4 py-1.5 text-sm font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill-hover)]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </header>

      {/* Clean storage slider bar */}
      <section className="rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-[var(--dc-text-strong)]">
            {formatMb(usedBytes)} used
          </p>
          <p className="text-xs text-[var(--dc-text-muted)]">
            {formatMb(limitBytes)} total
          </p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--dc-canvas)]">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              percent >= 90 ? 'bg-red-500' : 'bg-[var(--deepchat-accent)]'
            }`}
            style={{ width: `${Math.max(usedBytes > 0 ? 3 : 0, percent)}%` }}
          />
        </div>
      </section>

      {/* Controls */}
      <section className="divide-y divide-[var(--dc-border-subtle)] border-t border-[var(--dc-border-subtle)]">
        <div className="flex items-center justify-between gap-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">
              Automatically Space Up Storage
            </p>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
              Optimize images to WebP and clear Trash automatically after 2 days
            </p>
          </div>
          <ToggleSwitch
            checked={autoSpaceUp}
            onChange={handleToggleAutoSpace}
            ariaLabel="Automatically Space Up Storage"
          />
        </div>

        <div className="flex items-center justify-between gap-6 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">Delete Storage</p>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
              Permanently remove all images and clear your storage space
            </p>
          </div>
          {confirmDelete ? (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="h-9 rounded-full px-3.5 text-xs font-medium text-[var(--dc-text-muted)] hover:text-[var(--dc-text-strong)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleDeleteStorage()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-red-600 px-4 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Confirm'}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-red-500/30 px-4 text-xs font-medium text-red-500 transition-colors hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Storage</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
