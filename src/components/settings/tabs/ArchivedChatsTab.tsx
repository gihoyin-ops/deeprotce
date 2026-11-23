'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MessageSquare, Search } from '@/components/ui/icons';
import { deleteChat, getArchivedChats, unarchiveChat } from '@/app/actions';
import { PillDropdown, type PillDropdownOption } from '../PillDropdown';
import type { ArchivedChatItem } from '../types';

interface ArchivedChatsTabProps {
  onOpenChat: (chatId: string) => void;
}

type SortOrder = 'updated' | 'oldest' | 'title';

const SORT_OPTIONS: PillDropdownOption[] = [
  { label: 'Updated', value: 'updated' },
  { label: 'Oldest', value: 'oldest' },
  { label: 'Title', value: 'title' }
];

function formatDateLabel(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ArchivedChatsTab({ onOpenChat }: ArchivedChatsTabProps) {
  const [chats, setChats] = useState<ArchivedChatItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOrder>('updated');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadArchived = async () => {
    setIsLoading(true);
    try {
      const list = await getArchivedChats();
      setChats(list);
    } catch {
      setChats([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadArchived();
  }, []);

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? chats.filter(chat => (chat.title || 'Untitled').toLowerCase().includes(q))
      : [...chats];

    list.sort((a, b) => {
      if (sort === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return sort === 'oldest' ? timeA - timeB : timeB - timeA;
    });

    return list;
  }, [chats, search, sort]);

  const handleUnarchive = async (id: string) => {
    setBusyId(id);
    try {
      await unarchiveChat(id);
      setChats(prev => prev.filter(item => item.id !== id));
      window.dispatchEvent(new Event('chatUpdated'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteChat(id);
      setChats(prev => prev.filter(item => item.id !== id));
      window.dispatchEvent(new Event('chatUpdated'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h3 className="text-2xl font-semibold tracking-tight text-[var(--dc-text-strong)]">Archived chats</h3>
        <p className="mt-1 text-sm text-[var(--dc-text-muted)]">
          Find chats you&apos;ve archived and restore the ones you want to keep using
        </p>
      </header>

      {/* Search + Sort bar (matches screenshot 1) */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dc-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search archived chats"
            aria-label="Search archived chats"
            className="h-9 w-full rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)] pl-9 pr-4 text-sm text-[var(--dc-text-strong)] outline-none placeholder:text-[var(--dc-text-placeholder)] focus:border-[var(--dc-border-strong)]"
          />
        </div>

        <PillDropdown
          value={sort}
          options={SORT_OPTIONS}
          onChange={value => setSort(value as SortOrder)}
          ariaLabel="Sort archived chats"
        />
      </div>

      {/* Count header */}
      <div className="flex items-center justify-between border-b border-[var(--dc-border-subtle)] pb-2.5 text-xs font-medium text-[var(--dc-text-muted)]">
        <span>Archived conversations</span>
        <span>{filteredChats.length} {filteredChats.length === 1 ? 'chat' : 'chats'}</span>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2.5">
          <div className="h-14 animate-pulse rounded-2xl bg-[var(--dc-surface-muted)]" />
          <div className="h-14 animate-pulse rounded-2xl bg-[var(--dc-surface-muted)]" />
        </div>
      ) : filteredChats.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm font-medium text-[var(--dc-text-strong)]">
            {search.trim() ? 'No matching archived chats' : 'No archived chats'}
          </p>
          <p className="mt-1 text-xs text-[var(--dc-text-muted)]">
            {search.trim()
              ? 'Try another search term.'
              : 'Chats you archive will appear here so you can restore or delete them anytime.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--dc-border-subtle)]">
          {filteredChats.map(chat => {
            const isBusy = busyId === chat.id;
            return (
              <div key={chat.id} className="flex items-center justify-between gap-4 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <MessageSquare className="h-4 w-4 shrink-0 text-[var(--dc-text-muted)]" />
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpenChat(chat.id)}
                      className="block max-w-full truncate text-left text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {chat.title || 'Untitled Chat'}
                    </button>
                    <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">
                      {formatDateLabel(chat.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleUnarchive(chat.id)}
                    className="rounded-full bg-[var(--dc-fill)] px-3.5 py-1.5 text-xs font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill-hover)] disabled:opacity-50"
                  >
                    Unarchive
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleDelete(chat.id)}
                    className="rounded-full bg-red-50 px-3.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:bg-red-500/15 dark:text-red-400 dark:hover:bg-red-500/25"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
