'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import toast from 'react-hot-toast';
import {
  Check,
  ChevronRight,
  Download,
  Folder,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X
} from '@/components/ui/icons';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import { convertImageToWebp, downloadImageAsPng } from '@/lib/images/client-webp';

type LibraryTab = 'all' | 'images' | 'favorites' | 'folders' | 'suggested';

interface LibraryItem {
  id: string;
  folderId: string | null;
  r2Key: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  source: 'upload' | 'generated' | 'profile';
  isFavorite: boolean;
  metadata: Record<string, unknown> | null;
  trashedAt: number | null;
  purgeAt: number | null;
  createdAt: string;
  updatedAt: string;
}

interface LibraryFolder {
  id: string;
  name: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

interface LibraryResponse {
  ok?: boolean;
  authenticated?: boolean;
  guest?: boolean;
  error?: string;
  items?: LibraryItem[];
  trashedItems?: LibraryItem[];
  folders?: LibraryFolder[];
  storage?: {
    usedBytes: number;
    limitBytes: number;
  };
}

// New custom SVG: Library Settings (sliders/gear)
function LibrarySettingsSvg({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// New custom SVG: Cloud Storage
function CloudStorageSvg({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

function HeartSvg({ filled, className = 'h-4 w-4' }: { filled?: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.85}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

const formatPurgeCountdown = (purgeAt: number | null): string => {
  if (!purgeAt) return 'Auto-deletes in 48h';
  const diffMs = Math.max(0, purgeAt - Date.now());
  const hours = Math.ceil(diffMs / (60 * 60 * 1000));
  if (hours <= 1) return 'Deletes in <1h';
  return `Deletes in ${hours}h`;
};

const TABS: Array<{ id: LibraryTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'images', label: 'Images' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'folders', label: 'Folders' },
  { id: 'suggested', label: 'Suggested' }
];

export default function LibraryPage() {
  const pageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const holdOriginRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClickRef = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [trashedItems, setTrashedItems] = useState<LibraryItem[]>([]);
  const [folders, setFolders] = useState<LibraryFolder[]>([]);
  const [storage, setStorage] = useState<{ usedBytes: number; limitBytes: number }>({
    usedBytes: 0,
    limitBytes: 256 * 1024 * 1024
  });

  const [activeTab, setActiveTab] = useState<LibraryTab>('all');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'storage' | 'trash'>('storage');

  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const isSelecting = selectedIds.length > 0;

  const loadLibrary = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/library', { credentials: 'same-origin' });
      const data = (await res.json()) as LibraryResponse;
      if (data.guest || res.status === 401) {
        setIsGuest(true);
        return;
      }
      if (!res.ok) {
        toast.error(data.error || 'Could not load library.');
        return;
      }
      setIsGuest(false);
      setItems(data.items ?? []);
      setTrashedItems(data.trashedItems ?? []);
      setFolders(data.folders ?? []);
      if (data.storage) setStorage(data.storage);
    } catch {
      toast.error('Network error while loading library.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    const el = pageRef.current;
    if (isLoading || isGuest || !el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el.querySelectorAll('[data-lib-stagger]'),
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.045, ease: 'power3.out', clearProps: 'transform' }
      );
    }, pageRef);
    return () => ctx.revert();
  }, [isLoading, isGuest]);

  const runLibraryAction = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/library', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      throw new Error(data.error || 'Library action failed.');
    }
  };

  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || isUploading) return;
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) {
      toast.error('Only image files are supported in Library.');
      return;
    }

    setIsUploading(true);
    let uploadedCount = 0;
    try {
      for (const rawFile of files) {
        const { file } = await convertImageToWebp(rawFile, { quality: 0.88 });
        const form = new FormData();
        form.append('file', file);
        form.append('folder', 'library');
        if (activeFolderId) form.append('folderId', activeFolderId);

        const res = await fetch('/api/storage/upload', {
          method: 'POST',
          credentials: 'same-origin',
          body: form
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        if (!res.ok) {
          toast.error(data.message || data.error || `Failed to upload ${rawFile.name}`);
          break;
        }
        uploadedCount += 1;
      }

      if (uploadedCount > 0) {
        toast.success(
          uploadedCount === 1 ? 'Image added to library' : `${uploadedCount} images added`
        );
        await loadLibrary();
      }
    } catch {
      toast.error('Failed to process image upload.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdOriginRef.current = null;
  };

  const handleItemPointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    clearHoldTimer();
    holdOriginRef.current = { x: e.clientX, y: e.clientY };
    holdTimerRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = true;
      setSelectedIds(prev => (prev.includes(id) ? prev : [...prev, id]));
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }
    }, 420);
  };

  const handleItemPointerMove = (e: React.PointerEvent) => {
    if (!holdOriginRef.current) return;
    const dx = Math.abs(e.clientX - holdOriginRef.current.x);
    const dy = Math.abs(e.clientY - holdOriginRef.current.y);
    if (dx > 8 || dy > 8) {
      clearHoldTimer();
    }
  };

  const handleItemClick = (item: LibraryItem) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    if (isSelecting) {
      toggleSelect(item.id);
      return;
    }
    setPreviewItem(item);
  };

  const handleToggleFavorite = async (item: LibraryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextFav = !item.isFavorite;
    setItems(prev => prev.map(it => (it.id === item.id ? { ...it, isFavorite: nextFav } : it)));
    try {
      await runLibraryAction({ action: 'favorite', itemIds: [item.id], isFavorite: nextFav });
    } catch {
      setItems(prev => prev.map(it => (it.id === item.id ? { ...it, isFavorite: !nextFav } : it)));
      toast.error('Could not update favorite.');
    }
  };

  const handleDownloadSelected = async () => {
    const targets = items.filter(it => selectedIds.includes(it.id));
    if (targets.length === 0 || isDownloading) return;
    setIsDownloading(true);
    try {
      for (const item of targets) {
        await downloadImageAsPng(item.url, item.fileName);
      }
      toast.success(
        targets.length === 1 ? 'Downloaded as PNG' : `Downloaded ${targets.length} PNG images`
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleTrashSelected = async () => {
    if (selectedIds.length === 0) return;
    const ids = [...selectedIds];
    try {
      await runLibraryAction({ action: 'trash', itemIds: ids });
      setSelectedIds([]);
      setIsMoreMenuOpen(false);
      toast.success('Moved to Trash (auto-deletes in 2 days)');
      await loadLibrary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete.');
    }
  };

  const handleMoveSelected = async (targetFolderId: string | null) => {
    if (selectedIds.length === 0) return;
    try {
      await runLibraryAction({
        action: 'move',
        itemIds: selectedIds,
        folderId: targetFolderId
      });
      setSelectedIds([]);
      setIsMoveModalOpen(false);
      setIsMoreMenuOpen(false);
      toast.success(targetFolderId ? 'Moved to folder' : 'Removed from folder');
      await loadLibrary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to move items.');
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newFolderName.trim();
    if (!clean || isCreatingFolder) return;
    setIsCreatingFolder(true);
    try {
      await runLibraryAction({ action: 'createFolder', name: clean });
      setNewFolderName('');
      toast.success('Folder created');
      await loadLibrary();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create folder.');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleDeleteFolder = async (folder: LibraryFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await runLibraryAction({ action: 'deleteFolder', folderId: folder.id });
      if (activeFolderId === folder.id) setActiveFolderId(null);
      toast.success('Folder removed');
      await loadLibrary();
    } catch {
      toast.error('Could not delete folder.');
    }
  };

  const filteredFolders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter(f => f.name.toLowerCase().includes(q));
  }, [folders, searchQuery]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let base = items;

    if (activeFolderId) {
      base = base.filter(it => it.folderId === activeFolderId);
    } else if (activeTab === 'favorites') {
      base = base.filter(it => it.isFavorite);
    } else if (activeTab === 'suggested') {
      base = base.filter(it => it.source === 'generated' || (!it.folderId && !it.isFavorite));
    }

    if (q) {
      base = base.filter(it => {
        const prompt = typeof it.metadata?.prompt === 'string' ? it.metadata.prompt : '';
        const model = typeof it.metadata?.model === 'string' ? it.metadata.model : '';
        return (
          it.fileName.toLowerCase().includes(q) ||
          prompt.toLowerCase().includes(q) ||
          model.toLowerCase().includes(q)
        );
      });
    }

    return base;
  }, [items, activeTab, activeFolderId, searchQuery]);

  const activeFolder = useMemo(
    () => folders.find(f => f.id === activeFolderId) ?? null,
    [folders, activeFolderId]
  );

  const storagePercent = Math.min(
    100,
    Math.round((storage.usedBytes / Math.max(1, storage.limitBytes)) * 100)
  );

  if (isLoading) {
    return (
      <div className="custom-scrollbar h-full w-full overflow-y-auto bg-[var(--dc-canvas)] text-[var(--dc-text)]">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
          <div className="mb-6 flex items-center justify-between">
            <div className="h-7 w-28 animate-pulse rounded-lg bg-[var(--dc-surface)]" />
            <div className="h-9 w-32 animate-pulse rounded-full bg-[var(--dc-surface)]" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)]"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="custom-scrollbar flex h-full w-full items-center justify-center overflow-y-auto bg-[var(--dc-canvas)] px-6 text-[var(--dc-text)]">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold text-[var(--dc-text-strong)]">Sign in to use Library</h1>
          <p className="mt-2 text-sm text-[var(--dc-text-muted)]">
            Every account gets 256 MB of cloud image storage for uploads and generated images.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-[var(--dc-invert)] px-5 text-sm font-medium text-[var(--dc-text-on-invert)] transition-opacity hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="custom-scrollbar relative h-full w-full overflow-y-auto bg-[var(--dc-canvas)] text-[var(--dc-text)]"
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault();
        void handleUploadFiles(e.dataTransfer.files);
      }}
    >
      <div ref={pageRef} className="mx-auto max-w-4xl px-4 pb-28 pt-5 sm:px-8 sm:pt-8">
        {/* Clean minimal header */}
        <header data-lib-stagger className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--dc-text-strong)]">
              Library
            </h1>
            <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
              {items.length} {items.length === 1 ? 'image' : 'images'} · Hold any image to select
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={e => void handleUploadFiles(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--dc-invert)] px-4 text-xs font-medium text-[var(--dc-text-on-invert)] transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            >
              {isUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>{isUploading ? 'Uploading...' : 'Upload'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Library storage and trash"
              title="Storage & Trash"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] text-[var(--dc-text-muted)] transition-colors hover:border-[var(--dc-border-strong)] hover:text-[var(--dc-text-strong)] active:scale-95"
            >
              <LibrarySettingsSvg className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Search + Filter Tabs */}
        <div data-lib-stagger className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {TABS.map(tab => {
              const active = activeTab === tab.id && !activeFolderId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setActiveFolderId(null);
                  }}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[var(--dc-surface)] text-[var(--dc-text-strong)] border border-[var(--dc-border-subtle)]'
                      : 'text-[var(--dc-text-muted)] hover:text-[var(--dc-text-strong)]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--dc-text-muted)]" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search images or folders"
              className="h-9 w-full rounded-full border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] pl-8 pr-3 text-xs text-[var(--dc-text-strong)] placeholder:text-[var(--dc-text-muted)]/70 outline-none transition-colors focus:border-[var(--dc-border-strong)]"
            />
          </div>
        </div>

        {/* Active Folder Breadcrumb */}
        {activeFolder && (
          <div data-lib-stagger className="mt-5 flex items-center gap-2 text-xs text-[var(--dc-text-muted)]">
            <button
              type="button"
              onClick={() => setActiveFolderId(null)}
              className="hover:text-[var(--dc-text-strong)]"
            >
              Folders
            </button>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-medium text-[var(--dc-text-strong)]">{activeFolder.name}</span>
          </div>
        )}

        {/* Folders Section (clean minimal cards, NO circular background behind icons) */}
        {!activeFolderId && (activeTab === 'folders' || (activeTab === 'all' && filteredFolders.length > 0)) && (
          <section data-lib-stagger className="mt-6">
            {activeTab === 'folders' && (
              <form onSubmit={handleCreateFolder} className="mb-4 flex items-center gap-2">
                <input
                  type="text"
                  maxLength={64}
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  placeholder="New folder name"
                  className="h-9 w-full max-w-xs rounded-full border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] px-3.5 text-xs text-[var(--dc-text-strong)] outline-none focus:border-[var(--dc-border-strong)]"
                />
                <button
                  type="submit"
                  disabled={!newFolderName.trim() || isCreatingFolder}
                  className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] px-3.5 text-xs font-medium text-[var(--dc-text-strong)] transition-colors hover:border-[var(--dc-border-strong)] disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create</span>
                </button>
              </form>
            )}

            {filteredFolders.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {filteredFolders.map(folder => (
                  <div
                    key={folder.id}
                    onClick={() => setActiveFolderId(folder.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') setActiveFolderId(folder.id);
                    }}
                    className="group flex cursor-pointer items-center justify-between gap-2.5 rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] px-3.5 py-3 transition-colors hover:border-[var(--dc-border-strong)]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Folder className="h-4 w-4 shrink-0 text-[var(--dc-text-muted)]" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-[var(--dc-text-strong)]">
                          {folder.name}
                        </p>
                        <p className="text-[11px] text-[var(--dc-text-muted)]">
                          {folder.itemCount} {folder.itemCount === 1 ? 'item' : 'items'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={e => void handleDeleteFolder(folder, e)}
                      aria-label={`Delete folder ${folder.name}`}
                      className="rounded-full p-1 text-[var(--dc-text-muted)] opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              activeTab === 'folders' && (
                <p className="py-10 text-center text-xs text-[var(--dc-text-muted)]">
                  No folders yet. Create one above to organize your images.
                </p>
              )
            )}
          </section>
        )}

        {/* Images Grid */}
        {(activeTab !== 'folders' || activeFolderId) && (
          <section data-lib-stagger className="mt-6">
            {filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] px-6 py-14 text-center">
                <p className="text-sm font-medium text-[var(--dc-text-strong)]">No images found</p>
                <p className="mt-1 text-xs text-[var(--dc-text-muted)]">
                  Upload images or generate images in chat to see them here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {filteredItems.map(item => {
                  const selected = selectedIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onPointerDown={e => handleItemPointerDown(e, item.id)}
                      onPointerMove={handleItemPointerMove}
                      onPointerUp={clearHoldTimer}
                      onPointerCancel={clearHoldTimer}
                      onContextMenu={e => {
                        e.preventDefault();
                        toggleSelect(item.id);
                      }}
                      onClick={() => handleItemClick(item)}
                      className={`group relative aspect-square cursor-pointer select-none overflow-hidden rounded-2xl border bg-[var(--dc-surface)] transition-all duration-150 ${
                        selected
                          ? 'border-[var(--deepchat-accent)] ring-2 ring-[var(--deepchat-accent)]/40 scale-[0.98]'
                          : 'border-[var(--dc-border-subtle)] hover:border-[var(--dc-border-strong)]'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={item.fileName}
                        loading="lazy"
                        draggable={false}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />

                      {/* Selection Indicator */}
                      {(isSelecting || selected) && (
                        <div
                          className={`absolute left-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                            selected
                              ? 'border-[var(--deepchat-accent)] bg-[var(--deepchat-accent)] text-white'
                              : 'border-white/70 bg-black/35 text-transparent'
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </div>
                      )}

                      {/* Favorite Toggle */}
                      {!isSelecting && (
                        <button
                          type="button"
                          onClick={e => void handleToggleFavorite(item, e)}
                          aria-label={item.isFavorite ? 'Remove favorite' : 'Favorite image'}
                          className={`absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-xs transition-opacity ${
                            item.isFavorite ? 'opacity-100 text-rose-400' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <HeartSvg filled={item.isFavorite} className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Floating Selection Bar (Photo 2 style: count, Download, Delete, ... Move, Close) */}
      {isSelecting && (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <div className="relative flex items-center gap-1.5 rounded-full border border-[var(--dc-border)] bg-[#14161b] px-3 py-1.5 text-white shadow-xl">
            <span className="px-2 text-xs font-medium text-white/90">
              {selectedIds.length} selected
            </span>

            <button
              type="button"
              onClick={() => void handleDownloadSelected()}
              disabled={isDownloading}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-medium transition-colors hover:bg-white/15 disabled:opacity-60"
            >
              {isDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              <span>Download</span>
            </button>

            <button
              type="button"
              onClick={() => void handleTrashSelected()}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-red-500 px-3 text-xs font-medium text-white transition-opacity hover:opacity-90"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(prev => !prev)}
                aria-label="More actions"
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {isMoreMenuOpen && (
                <div className="absolute bottom-11 right-0 w-36 rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-1 text-[var(--dc-text-strong)] shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      setIsMoveModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-[var(--dc-surface-hover)]"
                  >
                    <Folder className="h-3.5 w-3.5 text-[var(--dc-text-muted)]" />
                    <span>Move</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedIds([]);
                setIsMoreMenuOpen(false);
              }}
              aria-label="Clear selection"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Move to Folder Modal */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xs rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--dc-text-strong)]">Move to folder</h2>
              <button
                type="button"
                onClick={() => setIsMoveModalOpen(false)}
                className="rounded-full p-1 text-[var(--dc-text-muted)] hover:text-[var(--dc-text-strong)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-60 space-y-1 overflow-y-auto">
              <button
                type="button"
                onClick={() => void handleMoveSelected(null)}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-medium text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
              >
                <span>No folder (All images)</span>
              </button>
              {folders.map(folder => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => void handleMoveSelected(folder.id)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-[var(--dc-text-strong)] hover:bg-[var(--dc-surface-hover)]"
                >
                  <Folder className="h-3.5 w-3.5 text-[var(--dc-text-muted)]" />
                  <span className="truncate">{folder.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Library Settings Modal: Storage (Cloud SVG) & Trash (2-day auto-purge) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--dc-text-strong)]">
                Library Settings
              </h2>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                aria-label="Close library settings"
                className="rounded-full p-1 text-[var(--dc-text-muted)] hover:text-[var(--dc-text-strong)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 flex items-center gap-1.5 border-b border-[var(--dc-border-subtle)] pb-3">
              <button
                type="button"
                onClick={() => setSettingsSection('storage')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  settingsSection === 'storage'
                    ? 'bg-[var(--dc-surface)] text-[var(--dc-text-strong)] border border-[var(--dc-border-subtle)]'
                    : 'text-[var(--dc-text-muted)] hover:text-[var(--dc-text-strong)]'
                }`}
              >
                <CloudStorageSvg className="h-3.5 w-3.5" />
                <span>Storage</span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsSection('trash')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  settingsSection === 'trash'
                    ? 'bg-[var(--dc-surface)] text-[var(--dc-text-strong)] border border-[var(--dc-border-subtle)]'
                    : 'text-[var(--dc-text-muted)] hover:text-[var(--dc-text-strong)]'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Trash ({trashedItems.length})</span>
              </button>
            </div>

            {settingsSection === 'storage' ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--dc-text-strong)]">
                      {formatBytes(storage.usedBytes)} used
                    </span>
                    <span className="text-[var(--dc-text-muted)]">
                      {formatBytes(storage.limitBytes)} total
                    </span>
                  </div>
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[var(--dc-canvas)]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        storagePercent >= 90 ? 'bg-red-500' : 'bg-[var(--deepchat-accent)]'
                      }`}
                      style={{ width: `${Math.max(2, storagePercent)}%` }}
                    />
                  </div>
                  <p className="mt-2.5 text-[11px] text-[var(--dc-text-muted)]">
                    Uploads are automatically optimized to WebP. Generated images and trashed items
                    count toward your 256 MB quota until permanently removed.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[var(--dc-text-muted)]">
                    Items in Trash are permanently deleted after 2 days.
                  </p>
                  {trashedItems.length > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        await runLibraryAction({ action: 'emptyTrash' });
                        toast.success('Trash emptied');
                        await loadLibrary();
                      }}
                      className="shrink-0 text-xs font-medium text-red-500 hover:underline"
                    >
                      Empty trash
                    </button>
                  )}
                </div>

                {trashedItems.length === 0 ? (
                  <p className="py-8 text-center text-xs text-[var(--dc-text-muted)]">
                    Trash is empty.
                  </p>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {trashedItems.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] p-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.url}
                            alt={item.fileName}
                            loading="lazy"
                            className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-[var(--dc-text-strong)]">
                              {item.fileName}
                            </p>
                            <p className="text-[11px] text-[var(--dc-text-muted)]">
                              {formatPurgeCountdown(item.purgeAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await runLibraryAction({ action: 'restore', itemIds: [item.id] });
                              toast.success('Restored');
                              await loadLibrary();
                            }}
                            className="rounded-full border border-[var(--dc-border-subtle)] px-2.5 py-1 text-[11px] font-medium text-[var(--dc-text-strong)] hover:border-[var(--dc-border-strong)]"
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await runLibraryAction({
                                action: 'deletePermanent',
                                itemIds: [item.id]
                              });
                              toast.success('Permanently deleted');
                              await loadLibrary();
                            }}
                            className="rounded-full px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-500/10"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clean Lightbox Preview */}
      {previewItem && (
        <div
          onClick={() => setPreviewItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative max-h-[90dvh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#111318] text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{previewItem.fileName}</p>
                <p className="text-[11px] text-white/60">
                  {formatBytes(previewItem.sizeBytes)}
                  {typeof previewItem.metadata?.model === 'string'
                    ? ` · ${previewItem.metadata.model}`
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void downloadImageAsPng(previewItem.url, previewItem.fileName)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-medium hover:bg-white/15"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex max-h-[72dvh] items-center justify-center bg-black/40 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewItem.url}
                alt={previewItem.fileName}
                className="max-h-[65dvh] w-auto rounded-lg object-contain"
              />
            </div>
            {typeof previewItem.metadata?.prompt === 'string' && previewItem.metadata.prompt && (
              <div className="border-t border-white/10 px-4 py-3 text-xs text-white/75">
                {previewItem.metadata.prompt}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
