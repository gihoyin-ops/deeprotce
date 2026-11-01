'use client';

import React, { useMemo, useState } from 'react';
import { Archive, Brain, Loader2, Search, ShieldAlert, Trash2, X } from '@/components/ui/icons';
import type { SavedMemory } from '@/app/memory';
import { Dialog, DialogHeader, dialogBody } from '../dialog';
import type { ArchivedChatItem, ConfirmDialogState } from '../types';

const pill = (tone: 'danger' | 'primary') => {
  const tones = {
    danger: 'bg-white text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:bg-slate-900/60 dark:border-slate-700/60 dark:text-slate-300 dark:hover:border-red-500/40 dark:hover:bg-red-500/10 dark:hover:text-red-300',
    primary: 'bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-900/60 dark:border-slate-700/60 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300'
  };
  return `rounded-full border border-slate-200 px-4 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${tones[tone]}`;
};

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700/60 dark:bg-slate-900/40">
      <div className="mx-auto mb-3 flex justify-center text-slate-300 dark:text-slate-600">{icon}</div>
      <p className="text-sm font-bold text-slate-700 dark:text-slate-100">{title}</p>
      <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

// archived chats dialog
interface ArchivedChatsDialogProps {
  open: boolean;
  closing: boolean;
  chats: ArchivedChatItem[];
  isLoading: boolean;
  deletingId: string | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onOpenChat: (id: string) => void;
}

export function ArchivedChatsDialog({ open, closing, chats, isLoading, deletingId, onClose, onDelete, onOpenChat }: ArchivedChatsDialogProps) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const visibleChats = useMemo(() => chats.filter(chat => {
    if (!needle) return true;
    return `${chat.title || ''} ${chat.id}`.toLowerCase().includes(needle);
  }), [chats, needle]);

  return (
    <Dialog open={open} closing={closing} zIndex={320} width="max-w-2xl" onClose={onClose}>
      <div className="border-b border-slate-100 p-4 dark:border-slate-700/60 sm:p-6">
        <DialogHeader title="Archived Chats" description="Search conversations that are hidden from the main chat list." onClose={onClose} />
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search archived chats..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500"
          />
        </div>
      </div>
      <div className={dialogBody}>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm font-bold text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading archived chats...
          </div>
        ) : visibleChats.length === 0 ? (
          <EmptyState icon={<Archive className="h-8 w-8" />} title="No archived chats found" hint="Archived conversations matching your search will appear here." />
        ) : (
          <div className="space-y-3">
            {visibleChats.map(chat => (
              <div key={chat.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-slate-800 dark:text-slate-100">{chat.title || 'Untitled Chat'}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {chat.messages?.length || 0} messages / {new Date(chat.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <button onClick={() => onDelete(chat.id)} disabled={deletingId === chat.id} className={pill('danger')}>
                      {deletingId === chat.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                    </button>
                    <button onClick={() => onOpenChat(chat.id)} className={pill('primary')}>Open</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}

// saved memories dialog
interface MemoriesDialogProps {
  open: boolean;
  closing: boolean;
  memories: SavedMemory[];
  isLoading: boolean;
  isClearing: boolean;
  deletingId: string | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export function MemoriesDialog({ open, closing, memories, isLoading, isClearing, deletingId, onClose, onDelete, onClearAll }: MemoriesDialogProps) {
  return (
    <Dialog open={open} closing={closing} zIndex={320} width="max-w-lg" onClose={onClose}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4 dark:border-slate-700/60 sm:p-6">
        <div className="min-w-0">
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">Saved Memories</h3>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            DeepChat remembers and automatically manages useful information from chat, making responses more relevant and personal.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {memories.length > 0 && (
            <button onClick={onClearAll} disabled={isClearing} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-red-500/40 dark:hover:bg-red-500/10 dark:hover:text-red-300">
              {isClearing ? 'Clearing...' : 'Clear all'}
            </button>
          )}
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200" aria-label="Close memories">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className={dialogBody}>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm font-bold text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading memories...
          </div>
        ) : memories.length === 0 ? (
          <EmptyState icon={<Brain className="h-8 w-8" />} title="No saved memories yet" hint="Useful details from future chats will appear here." />
        ) : (
          <div className="space-y-3">
            {memories.map(memory => (
              <div key={memory.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">{memory.category}</span>
                      {memory.sourceProvider && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                          {memory.sourceProvider}{memory.sourceModel ? ` / ${memory.sourceModel}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold leading-relaxed text-slate-800 dark:text-slate-100">{memory.content}</p>
                  </div>
                  <button
                    onClick={() => onDelete(memory.id)}
                    disabled={deletingId === memory.id}
                    className="rounded-full p-2 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-600 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                    aria-label="Delete memory"
                  >
                    {deletingId === memory.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}

// delete confirmation dialog
export function ConfirmDialog({ state, closing, isBusy, onCancel, onConfirm }: {
  state: ConfirmDialogState | null;
  closing: boolean;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={Boolean(state)} closing={closing} zIndex={350} width="max-w-md" onClose={onCancel}>
      {state && (
        <div className="p-6">
          <div className="mb-5 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">{state.title}</h3>
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{state.description}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isBusy}
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isBusy}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              {state.confirmLabel}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
