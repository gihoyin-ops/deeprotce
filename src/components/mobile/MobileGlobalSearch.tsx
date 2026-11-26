'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import { getChats } from '@/app/actions';
import {
  FileText,
  Folder,
  Image as ImageIcon,
  MessageSquare,
  Search,
  X
} from '@/components/ui/icons';
import GlobalImagePreviewModal from '@/components/ui/GlobalImagePreviewModal';
import { listGuestLibraryData } from '@/lib/storage/guest-library';
import type { StoredChat } from '@/lib/storage/types';
import { prefersReducedMotion } from './gesture-utils';

type SearchTab = 'all' | 'chats' | 'img' | 'document' | 'project';

interface SearchEntry {
  id: string;
  kind: 'chats' | 'img' | 'document' | 'project';
  title: string;
  subtitle: string;
  href?: string;
  imageUrl?: string;
  searchBlob: string;
}

interface MobileGlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif']);

const SEARCH_TABS: Array<{ id: SearchTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'chats', label: 'Chats' },
  { id: 'img', label: 'Images' },
  { id: 'document', label: 'Documents' },
  { id: 'project', label: 'Projects' }
];

export default function MobileGlobalSearch({ isOpen, onClose }: MobileGlobalSearchProps) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null);

  const loadEntries = useCallback(async () => {
    const collected: SearchEntry[] = [];
    const seenIds = new Set<string>();

    try {
      const chats = (await getChats()) as StoredChat[];
      const seenFolders = new Set<string>();

      for (const chat of chats) {
        const chatId = typeof chat.id === 'string' ? chat.id : '';
        if (!chatId) continue;
        const title = (chat.title || 'New Chat').trim();

        const msgTexts: string[] = [];
        for (const msg of chat.messages || []) {
          if (typeof msg.content === 'string') {
            msgTexts.push(msg.content.slice(0, 240));
          }
          const files = [
            ...(Array.isArray(msg.attachedFiles) ? msg.attachedFiles : []),
            ...(msg.attachedFile ? [msg.attachedFile] : [])
          ];
          for (const f of files) {
            const name = typeof f.name === 'string' ? f.name : 'Attachment';
            const ext = (typeof f.ext === 'string' ? f.ext : name.split('.').pop() || '').toLowerCase();
            const isImg = IMAGE_EXTS.has(ext) || Boolean(f.dataUrl?.startsWith('data:image/'));
            if (isImg) {
              const src = f.dataUrl || f.previewUrl || '';
              if (src && !seenIds.has(`chat-img-${chatId}-${name}`)) {
                seenIds.add(`chat-img-${chatId}-${name}`);
                collected.push({
                  id: `chat-img-${chatId}-${name}`,
                  kind: 'img',
                  title: name,
                  subtitle: `In ${title}`,
                  imageUrl: src,
                  href: `/chat/${chatId}`,
                  searchBlob: `${name} ${title}`.toLowerCase()
                });
              }
            } else if (!seenIds.has(`doc-${chatId}-${name}`)) {
              seenIds.add(`doc-${chatId}-${name}`);
              collected.push({
                id: `doc-${chatId}-${name}`,
                kind: 'document',
                title: name,
                subtitle: `${ext ? ext.toUpperCase() + ' · ' : ''}In ${title}`,
                href: `/chat/${chatId}`,
                searchBlob: `${name} ${ext} ${title}`.toLowerCase()
              });
            }
          }
        }

        collected.push({
          id: `chat-${chatId}`,
          kind: 'chats',
          title,
          subtitle: msgTexts[0] ? msgTexts[0].slice(0, 72) : 'Conversation',
          href: `/chat/${chatId}`,
          searchBlob: `${title} ${msgTexts.join(' ')}`.toLowerCase()
        });

        if (typeof chat.folder === 'string' && chat.folder.trim() && !seenFolders.has(chat.folder)) {
          seenFolders.add(chat.folder);
          collected.push({
            id: `chat-proj-${chat.folder}`,
            kind: 'project',
            title: chat.folder,
            subtitle: 'Chat project',
            href: `/chat/${chatId}`,
            searchBlob: chat.folder.toLowerCase()
          });
        }
      }
    } catch {}

    try {
      const res = await fetch('/api/library', { credentials: 'same-origin' });
      const data = (await res.json().catch(() => ({}))) as {
        guest?: boolean;
        items?: Array<{ id: string; url: string; fileName: string; metadata?: Record<string, unknown> | null }>;
        folders?: Array<{ id: string; name: string; itemCount: number }>;
      };

      const libItems = data.guest || res.status === 401
        ? (await listGuestLibraryData()).items
        : data.items ?? [];
      const libFolders = data.guest || res.status === 401
        ? (await listGuestLibraryData()).folders
        : data.folders ?? [];

      for (const img of libItems) {
        if (seenIds.has(`lib-img-${img.id}`)) continue;
        seenIds.add(`lib-img-${img.id}`);
        const prompt = typeof img.metadata?.prompt === 'string' ? img.metadata.prompt : '';
        collected.push({
          id: `lib-img-${img.id}`,
          kind: 'img',
          title: img.fileName,
          subtitle: prompt ? prompt.slice(0, 64) : 'Library image',
          imageUrl: img.url,
          href: '/library',
          searchBlob: `${img.fileName} ${prompt}`.toLowerCase()
        });
      }

      for (const folder of libFolders) {
        collected.push({
          id: `lib-folder-${folder.id}`,
          kind: 'project',
          title: folder.name,
          subtitle: `Library folder · ${folder.itemCount} items`,
          href: '/library',
          searchBlob: folder.name.toLowerCase()
        });
      }
    } catch {}

    setEntries(collected);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadEntries();

    const focusTimer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 120);

    const el = overlayRef.current;
    if (el && !prefersReducedMotion()) {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.3, ease: 'expo.out', clearProps: 'transform' }
        );
      }, overlayRef);
      return () => {
        window.clearTimeout(focusTimer);
        ctx.revert();
      };
    }

    return () => window.clearTimeout(focusTimer);
  }, [isOpen, loadEntries]);

  const handleClose = useCallback(() => {
    const el = overlayRef.current;
    if (el && !prefersReducedMotion()) {
      gsap.to(el, {
        opacity: 0,
        y: 12,
        duration: 0.2,
        ease: 'power2.in',
        onComplete: onClose
      });
    } else {
      onClose();
    }
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(entry => {
      if (activeTab !== 'all' && entry.kind !== activeTab) return false;
      if (!q) return true;
      return entry.searchBlob.includes(q);
    });
  }, [entries, activeTab, query]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
      className="fixed inset-0 z-[120] flex flex-col bg-[var(--dc-canvas)] text-[var(--dc-text)] sm:hidden"
    >
      {/* Top filter tabs */}
      <div className="shrink-0 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {SEARCH_TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[var(--dc-surface)] text-[var(--dc-text-strong)]'
                    : 'text-[var(--dc-text-muted)] hover:text-[var(--dc-text-strong)]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable search results */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-2">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <Search className="mb-2.5 h-6 w-6 text-[var(--dc-text-muted)]/60" />
            <p className="text-sm font-medium text-[var(--dc-text-strong)]">
              {query.trim() ? 'No matching results' : 'Search across DeepChat'}
            </p>
            <p className="mt-1 text-xs text-[var(--dc-text-muted)]">
              Chats, images, documents, and projects appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 pb-4">
            {filtered.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.kind === 'img' && item.imageUrl) {
                    setPreviewImage({ src: item.imageUrl, name: item.title });
                    return;
                  }
                  if (item.href) {
                    handleClose();
                    router.push(item.href);
                  }
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors active:scale-[0.99] hover:bg-[var(--dc-surface)]"
              >
                {item.kind === 'img' && item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    loading="lazy"
                    className="h-10 w-10 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--dc-surface)] text-[var(--dc-text-strong)]">
                    {item.kind === 'chats' && <MessageSquare className="h-4 w-4" />}
                    {item.kind === 'img' && <ImageIcon className="h-4 w-4" />}
                    {item.kind === 'document' && <FileText className="h-4 w-4" />}
                    {item.kind === 'project' && <Folder className="h-4 w-4" />}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-[var(--dc-text-strong)]">
                    {item.title}
                  </p>
                  <p className="truncate text-xs text-[var(--dc-text-muted)]">{item.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom search box and circular close button */}
      <div className="shrink-0 px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-2">
        <div className="flex items-end gap-2.5">
          <div className="flex min-h-[44px] flex-1 items-center rounded-3xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] px-4 py-2">
            <Search className="mr-2.5 h-4 w-4 shrink-0 text-[var(--dc-text-muted)]" />
            <textarea
              ref={textareaRef}
              rows={1}
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                e.currentTarget.style.height = 'auto';
                e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 88)}px`;
              }}
              placeholder="Search..."
              aria-label="Global search"
              className="max-h-[88px] min-w-0 flex-1 resize-none bg-transparent text-[15px] leading-snug text-[var(--dc-text-strong)] placeholder:text-[var(--dc-text-muted)]/70 outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close search"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] text-[var(--dc-text-strong)] transition-transform active:scale-90"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <GlobalImagePreviewModal
        isOpen={Boolean(previewImage)}
        src={previewImage?.src || ''}
        alt={previewImage?.name || 'Image preview'}
        fileName={previewImage?.name}
        onClose={() => setPreviewImage(null)}
      />
    </div>,
    document.body
  );
}
