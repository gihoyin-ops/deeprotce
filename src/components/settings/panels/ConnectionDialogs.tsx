'use client';

import React from 'react';
import { Copy, ExternalLink, Link as LinkIcon, Loader2 } from '@/components/ui/icons';
import { Dialog, DialogHeader, dialogBody } from '../dialog';
import type { SharedLinkItem } from '../types';

// shared links modal
export function SharedLinksDialog({ open, closing, links, isLoading, onClose, onCopy }: {
  open: boolean;
  closing: boolean;
  links: SharedLinkItem[];
  isLoading: boolean;
  onClose: () => void;
  onCopy: (shareId: string) => void;
}) {
  return (
    <Dialog open={open} closing={closing} zIndex={320} width="max-w-2xl" onClose={onClose}>
      <DialogHeader title="Shared Links" description="Manage chats that can be opened through shared URLs." onClose={onClose} />
      <div className={dialogBody}>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm font-bold text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading shared links...
          </div>
        ) : links.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700/60 dark:bg-slate-900/40">
            <LinkIcon className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-100">No shared links yet</p>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Shared chats will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map(link => {
              const url = `${window.location.origin}/chat/s/${link.shareId}`;
              return (
                <div key={link.shareId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-slate-800 dark:text-slate-100">{link.title}</p>
                      <p className="mt-1 truncate text-xs font-semibold text-indigo-600 dark:text-indigo-300">{url}</p>
                      <p className="mt-2 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                        {link.messageCount} messages / {new Date(link.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button onClick={() => onCopy(link.shareId)} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300" title="Copy link">
                        <Copy className="h-4 w-4" />
                      </button>
                      <button onClick={() => window.open(url, '_blank', 'noopener,noreferrer')} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300" title="Open link">
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Dialog>
  );
}
