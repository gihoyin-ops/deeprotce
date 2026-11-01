'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Copy, Cpu, ExternalLink, Link as LinkIcon, Loader2, Settings as SettingsIcon, Zap } from '@/components/ui/icons';
import { AddConnectionForm } from '../add-connection-form';
import { Dialog, DialogHeader, dialogBody } from '../dialog';
import { Spinner } from '../primitives';
import type { Connection, SharedLinkItem, VerifySteps, VerifyStepStatus } from '../types';

// add or edit connection modal
interface ConnectionDialogProps {
  open: boolean;
  closing: boolean;
  editing: Connection | null;
  onClose: () => void;
  onSave: (connection: Connection) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}

export function ConnectionDialog({ open, closing, editing, onClose, onSave, onDelete }: ConnectionDialogProps) {
  return (
    <Dialog open={open} closing={closing} zIndex={200} width="max-w-lg" onClose={onClose}>
      <DialogHeader title={editing ? 'Edit Connection' : 'Add Connection'} onClose={onClose} />
      <div className={dialogBody}>
        <AddConnectionForm initialData={editing} onSave={onSave} onDelete={onDelete} />
      </div>
    </Dialog>
  );
}

// additional connection profiles
export function ConnectionProfilesDialog({ open, connections, onClose, onVerify, onEdit }: {
  open: boolean;
  connections: Connection[];
  onClose: () => void;
  onVerify: (connection: Connection) => void;
  onEdit: (connection: Connection) => void;
}) {
  return (
    <Dialog open={open} closing={false} zIndex={210} width="max-w-3xl" onClose={onClose}>
      <DialogHeader title="Connection Profile" description="Review, verify, and edit every configured provider profile." onClose={onClose} />
      <div className={dialogBody}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {connections.map(connection => (
            <div key={connection.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-200 dark:border-slate-700/60 dark:bg-slate-900/60 dark:hover:border-indigo-500/40">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-lg font-extrabold text-indigo-600 shadow-inner dark:bg-indigo-500/15 dark:text-indigo-300">
                  {connection.provider.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-slate-800 dark:text-slate-100">{connection.name || connection.provider}</p>
                  <p className="mt-1 truncate text-xs font-bold text-indigo-600 dark:text-indigo-300">{connection.provider}</p>
                  {connection.model && <p className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">{connection.model}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => onVerify(connection)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-amber-500/40 dark:hover:bg-amber-500/10 dark:hover:text-amber-300">
                  <Zap className="h-4 w-4" /> Verify
                </button>
                <button onClick={() => onEdit(connection)} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700/60 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300">
                  <SettingsIcon className="h-4 w-4" /> Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  );
}

// verify connection modal
export function VerifyDialog({ open, closing, steps, error, onClose }: {
  open: boolean;
  closing: boolean;
  steps: VerifySteps;
  error: string | null;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <Dialog open closing={closing} zIndex={300} width="max-w-sm" onClose={() => undefined}>
      <div className="flex flex-col items-center p-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-500/15">
          <Cpu className="h-8 w-8 text-indigo-600 dark:text-indigo-300" />
        </div>
        <h3 className="mb-1 text-xl font-bold text-slate-800 dark:text-slate-100">Verifying Connection</h3>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">Please wait while we test your configuration.</p>

        <div className="mb-6 w-full space-y-3">
          <VerifyStep label="Non-Streaming Test" status={steps.nonStream} />
          <VerifyStep label="Streaming Test" status={steps.stream} />
        </div>

        {error && (
          <div className="mb-6 flex w-full items-start gap-2 rounded-xl bg-red-50 p-4 text-left text-sm font-medium text-red-600 dark:bg-red-500/10 dark:text-red-300">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {error ? (
          <button onClick={onClose} className="w-full rounded-xl bg-slate-100 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            Close
          </button>
        ) : steps.stream === 'success' ? (
          <button disabled className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 font-bold text-white">
            <CheckCircle2 className="h-5 w-5" /> Verified Successfully
          </button>
        ) : null}
      </div>
    </Dialog>
  );
}

function VerifyStep({ label, status }: { label: string; status: VerifyStepStatus }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700/60 dark:bg-slate-900/40">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
      {status === 'pending' && <span className="h-5 w-5 rounded-full border-2 border-slate-200 dark:border-slate-700" />}
      {status === 'loading' && <Spinner className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />}
      {status === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
      {status === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
    </div>
  );
}

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
