'use client';

import React from 'react';
import { Cpu, Plus } from '@/components/ui/icons';
import type { InstalledMCPServer, MCPSettings } from '@/lib/mcp/mcp-settings';
import { MCPInstalledRow } from '../components';
import { PrimaryButton, TabHeader } from '../primitives';

interface MCPTabProps {
  settings: MCPSettings;
  onOpenManager: (tab: 'installed' | 'browse') => void;
  onToggle: (installedId: string, enabled: boolean) => void;
  onRemove: (installedId: string) => void;
  onConfigure: (server: InstalledMCPServer) => void;
}

// mcp settings tab
export function MCPTab({ settings, onOpenManager, onToggle, onRemove, onConfigure }: MCPTabProps) {
  const installed = settings.installed;
  const enabledCount = installed.filter(server => server.enabled).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <TabHeader title="MCP Settings" description="Model Context Protocol server configurations." />
        {installed.length > 0 && (
          <PrimaryButton onClick={() => onOpenManager('browse')} icon={<Plus className="h-4 w-4" />} className="w-full sm:w-auto sm:mr-10">
            Add MCP
          </PrimaryButton>
        )}
      </div>

      {installed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center sm:p-10 dark:border-slate-700/60 dark:bg-slate-900/40">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-100 bg-white text-indigo-500 shadow-sm dark:border-indigo-500/20 dark:bg-slate-900 dark:text-indigo-300">
            <Cpu className="h-7 w-7" />
          </div>
          <p className="mb-1 font-bold text-slate-700 dark:text-slate-100">No MCP Servers Configured</p>
          <p className="mb-6 max-w-sm text-sm text-slate-500 dark:text-slate-400">
            Open MCP Manager to browse ready-to-install servers for files, databases, developer tools, productivity apps, and automation.
          </p>
          <button
            onClick={() => onOpenManager('browse')}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 font-bold text-slate-700 shadow-sm transition-all hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:text-indigo-300"
          >
            <Plus className="h-4 w-4" /> Add MCP Server
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/60 dark:bg-slate-900/40">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{installed.length} Installed MCP</p>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{enabledCount} enabled servers ready for assistant context.</p>
              </div>
              <button
                onClick={() => onOpenManager('installed')}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
              >
                Manage MCP
              </button>
            </div>
          </div>
          {installed.map(server => (
            <MCPInstalledRow key={server.id} server={server} onToggle={onToggle} onRemove={onRemove} onConfigure={onConfigure} />
          ))}
        </div>
      )}
    </div>
  );
}
