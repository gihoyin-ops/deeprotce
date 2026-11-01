'use client';

import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Cpu, Search } from '@/components/ui/icons';
import { installMCPServer, MCP_CATALOG, type InstalledMCPServer, type MCPServerCategory, type MCPSettings } from '@/lib/mcp/mcp-settings';
import { installTool, TOOL_CATALOG, type InstalledTool, type ToolCategory, type ToolSettings } from '@/lib/settings/tool-settings';
import { MCPBrowseCard, MCPInstalledRow, ToolBrowseCard, ToolInstalledRow } from '../components';
import { MCP_AVAILABILITY_OPTIONS, MCP_CATEGORY_OPTIONS, TOOL_CATEGORY_OPTIONS } from '../constants';
import { Dialog, DialogHeader, dialogBody } from '../dialog';
import { PrimaryButton } from '../primitives';

const searchInput = 'w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:bg-slate-900';

const filterChip = (active: boolean, tone: 'indigo' | 'emerald' = 'indigo') => {
  const activeTone = tone === 'emerald'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300'
    : 'border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-300';
  return `shrink-0 rounded-full border px-3 py-1.5 text-xs font-extrabold capitalize transition-colors ${active
    ? activeTone
    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200'}`;
};

const tabButton = (active: boolean) => `flex-1 rounded-xl px-4 py-2.5 text-sm font-extrabold transition-all ${active
  ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-300'
  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`;

const EmptyState = ({ title, hint }: { title: string; hint: string }) => (
  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700/60 dark:bg-slate-900/60">
    <p className="text-sm font-bold text-slate-700 dark:text-slate-100">{title}</p>
    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{hint}</p>
  </div>
);

// mcp server manager modal
interface MCPManagerDialogProps {
  open: boolean;
  closing: boolean;
  settings: MCPSettings;
  onClose: () => void;
  onToggle: (installedId: string, enabled: boolean) => void;
  onRemove: (installedId: string) => void;
  onConfigure: (server: InstalledMCPServer) => void;
  onInstalledChange: (next: MCPSettings) => void;
  onConfigureCatalog: (serverId: string) => void;
}

// mcp catalog browser
export function MCPManagerDialog({ open, closing, settings, onClose, onToggle, onRemove, onConfigure, onInstalledChange, onConfigureCatalog }: MCPManagerDialogProps) {
  const [tab, setTab] = useState<'installed' | 'browse'>('installed');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | MCPServerCategory>('All');
  const [availability, setAvailability] = useState<'All' | 'offline' | 'online'>('All');

  const handleInstall = (serverId: string) => {
    onInstalledChange(installMCPServer(serverId));
    toast.success('MCP installed');
    setTab('installed');
  };

  const installedIds = new Set(settings.installed.map(server => server.serverId));
  const needle = query.trim().toLowerCase();
  const results = useMemo(() => MCP_CATALOG.filter(server => {
    if (category !== 'All' && server.category !== category) return false;
    if (availability !== 'All' && server.availability !== availability) return false;
    if (!needle) return true;
    return `${server.name} ${server.description} ${server.category} ${server.tags.join(' ')}`.toLowerCase().includes(needle);
  }), [needle, category, availability]);

  return (
    <Dialog open={open} closing={closing} zIndex={260} onClose={onClose}>
      <div className="border-b border-slate-100 p-4 dark:border-slate-700/60 sm:p-6">
        <DialogHeader title="MCP Manager" description="Install, enable, and manage Model Context Protocol servers." onClose={onClose} />
        <div className="mt-4 flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-900">
          <button onClick={() => setTab('installed')} className={tabButton(tab === 'installed')}>Installed MCP</button>
          <button onClick={() => setTab('browse')} className={tabButton(tab === 'browse')}>Browse</button>
        </div>
      </div>

      <div className={dialogBody}>
        {tab === 'installed' ? (
          settings.installed.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700/60 dark:bg-slate-900/60">
              <Cpu className="mb-4 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-extrabold text-slate-700 dark:text-slate-100">No installed MCP yet</p>
              <p className="mt-1 max-w-sm text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">Browse the catalog and install MCP servers that match your workflow.</p>
              <PrimaryButton onClick={() => setTab('browse')} className="mt-5">Browse MCP</PrimaryButton>
            </div>
          ) : (
            <div className="space-y-3">
              {settings.installed.map(server => (
                <MCPInstalledRow key={server.id} server={server} onToggle={onToggle} onRemove={onRemove} onConfigure={onConfigure} />
              ))}
            </div>
          )
        ) : (
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search MCP servers..." className={searchInput} />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {MCP_CATEGORY_OPTIONS.map(option => (
                  <button key={option} onClick={() => setCategory(option)} className={filterChip(category === option)}>{option}</button>
                ))}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {MCP_AVAILABILITY_OPTIONS.map(option => (
                  <button key={option} onClick={() => setAvailability(option)} className={filterChip(availability === option, 'emerald')}>{option}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {results.map(server => (
                <MCPBrowseCard
                  key={server.id}
                  server={server}
                  installed={installedIds.has(server.id)}
                  onInstall={handleInstall}
                  onConfigure={onConfigureCatalog}
                />
              ))}
            </div>
            {results.length === 0 && <EmptyState title="No MCP found" hint="Try another keyword or category." />}
          </div>
        )}
      </div>
    </Dialog>
  );
}

// search provider modal
interface SearchManagerDialogProps {
  open: boolean;
  closing: boolean;
  settings: ToolSettings;
  onClose: () => void;
  onToggle: (installedId: string, enabled: boolean) => void;
  onRemove: (installedId: string) => void;
  onConfigure: (tool: InstalledTool) => void;
  onInstalledChange: (next: ToolSettings) => void;
  onConfigureCatalog: (toolId: string) => void;
}

// select single search provider
export function SearchManagerDialog({ open, closing, settings, onClose, onToggle, onRemove, onConfigure, onInstalledChange, onConfigureCatalog }: SearchManagerDialogProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | ToolCategory>('All');

  const handleInstall = (toolId: string) => {
    const next = installTool(toolId);
    onInstalledChange(next.searchEnabled ? next : { ...next, searchEnabled: true });
    toast.success('Search provider selected');
  };

  const installedIds = new Set(settings.installed.map(tool => tool.toolId));
  const needle = query.trim().toLowerCase();
  const results = useMemo(() => TOOL_CATALOG.filter(tool => {
    if (category !== 'All' && tool.category !== category) return false;
    if (!needle) return true;
    return `${tool.name} ${tool.description} ${tool.category} ${tool.tags.join(' ')}`.toLowerCase().includes(needle);
  }), [needle, category]);

  return (
    <Dialog open={open} closing={closing} zIndex={280} onClose={onClose}>
      <div className="border-b border-slate-100 p-4 dark:border-slate-700/60 sm:p-6">
        <DialogHeader title="Search API" description="Manage API-based and no-API search providers." onClose={onClose} />
        <div className="mt-4 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search providers..." className={searchInput} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {TOOL_CATEGORY_OPTIONS.map(option => (
              <button key={option} onClick={() => setCategory(option)} className={filterChip(category === option)}>{option}</button>
            ))}
          </div>
        </div>
      </div>

      <div className={dialogBody}>
        {settings.installed.length > 0 && (
          <div className="mb-6 space-y-3">
            <div>
              <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">Installed providers</p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Only one Search provider can be active at a time. DuckDuckGo is used by default when none is selected.</p>
            </div>
            {settings.installed.map(tool => (
              <ToolInstalledRow key={tool.id} tool={tool} onToggle={onToggle} onRemove={onRemove} onConfigure={onConfigure} />
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {results.map(tool => (
            <ToolBrowseCard
              key={tool.id}
              tool={tool}
              installed={installedIds.has(tool.id)}
              onInstall={handleInstall}
              onConfigure={onConfigureCatalog}
            />
          ))}
        </div>
        {results.length === 0 && <EmptyState title="No provider found" hint="Try another keyword or category." />}
      </div>
    </Dialog>
  );
}
