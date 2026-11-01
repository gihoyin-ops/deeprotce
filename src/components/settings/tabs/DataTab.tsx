'use client';

import React from 'react';
import { Archive, Download, Link as LinkIcon, Loader2, MessageSquare, ShieldAlert, Trash2 } from '@/components/ui/icons';
import { TabHeader } from '../primitives';
import { dataCard, dataCardAmberButton, dataCardButton, dataCardDangerButton, dataCardEmeraldButton, dataCardIcon } from '../theme';

interface DataTabProps {
  isExporting: boolean;
  isArchivingAll: boolean;
  isDeletingChats: boolean;
  onOpenSharedLinks: () => void;
  onOpenArchivedChats: () => void;
  onArchiveAll: () => void;
  onExport: () => void;
  onDeleteAllChats: () => void;
}

// data action row shell
function DataCard({ icon, tone, title, description, action }: {
  icon: React.ReactNode;
  tone: 'indigo' | 'amber' | 'emerald' | 'red';
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className={dataCard}>
      <div className="flex items-start gap-4">
        <div className={dataCardIcon(tone)}>{icon}</div>
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100">{title}</p>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

// export, archive, and clear actions
export function DataTab({ isExporting, isArchivingAll, isDeletingChats, onOpenSharedLinks, onOpenArchivedChats, onArchiveAll, onExport, onDeleteAllChats }: DataTabProps) {
  return (
    <div className="space-y-8">
      <TabHeader title="Data Control" description="Manage your personal data and application storage." />

      <div className="space-y-4">
        <DataCard
          icon={<LinkIcon className="h-6 w-6" />}
          tone="indigo"
          title="Shared Links"
          description="Review chats that are available through public share links."
          action={<button onClick={onOpenSharedLinks} className={dataCardButton}>Manage</button>}
        />
        <DataCard
          icon={<Archive className="h-6 w-6" />}
          tone="indigo"
          title="Archived Chats"
          description="Find and review conversations hidden from your main chat list."
          action={<button onClick={onOpenArchivedChats} className={dataCardButton}>Manage</button>}
        />
        <DataCard
          icon={<Archive className="h-6 w-6" />}
          tone="amber"
          title="Archive All Chats"
          description="Move every active conversation out of the main chat list."
          action={
            <button onClick={onArchiveAll} disabled={isArchivingAll} className={dataCardAmberButton}>
              {isArchivingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              Archive All
            </button>
          }
        />
        <DataCard
          icon={<Download className="h-6 w-6" />}
          tone="emerald"
          title="Export Data"
          description="Download your chats, settings, memories, and application data."
          action={
            <button onClick={onExport} disabled={isExporting} className={dataCardEmeraldButton}>
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export
            </button>
          }
        />
        <DataCard
          icon={<MessageSquare className="h-6 w-6" />}
          tone="red"
          title="Delete All Chats"
          description="Permanently remove all conversation history."
          action={
            <button onClick={onDeleteAllChats} disabled={isDeletingChats} className={dataCardDangerButton}>
              {isDeletingChats ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Clear All
            </button>
          }
        />

        <div className="rounded-2xl border border-red-100 bg-red-50/50 p-4 dark:border-red-500/25 dark:bg-red-500/10 sm:p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
            <div>
              <p className="text-sm font-bold text-red-800 dark:text-red-300">Dangerous Actions</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-red-600/80 dark:text-red-300/80">
                These actions are irreversible. Once deleted, your data cannot be recovered. Please make sure you have backups of any important information before proceeding.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
