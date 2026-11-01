'use client';

import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import GsapMorphSvg from '@/components/ui/GsapMorphSvg';
import { Cpu, Search, Settings as SettingsIcon, Trash2 } from '@/components/ui/icons';
import type { MCPCatalogServer, InstalledMCPServer } from '@/lib/mcp/mcp-settings';
import type { InstalledTool, TOOL_CATALOG } from '@/lib/settings/tool-settings';
import { StatusPill } from './primitives';

// rows for mcp and tools

const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-200 dark:border-slate-700/60 dark:bg-slate-900/60 dark:hover:border-indigo-500/40';
const iconButton = 'rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300';
const installButton = (installed: boolean) => `rounded-xl px-4 py-2 text-xs font-extrabold transition-colors ${installed
  ? 'cursor-default bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300'
  : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400'}`;

// shared toggle row
export function RowSwitch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  const thumbRef = useRef<HTMLSpanElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!thumbRef.current) return;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      gsap.set(thumbRef.current, { x: checked ? 24 : 0 });
      return;
    }

    gsap.killTweensOf(thumbRef.current);
    gsap.fromTo(
      thumbRef.current,
      { scaleX: 1.25, scaleY: 0.88 },
      {
        x: checked ? 24 : 0,
        scaleX: 1,
        scaleY: 1,
        duration: 0.28,
        ease: 'back.out(1.8)'
      }
    );
  }, [checked]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-14 shrink-0 rounded-full p-1 transition-colors duration-200 ${checked ? 'bg-indigo-600 dark:bg-indigo-500 shadow-sm shadow-indigo-600/30' : 'bg-slate-300 dark:bg-slate-700'}`}
    >
      <span ref={thumbRef} className="block h-6 w-6 rounded-full bg-white shadow-md will-change-transform" />
    </button>
  );
}

export function MCPInstalledRow({ server, onToggle, onRemove, onConfigure }: {
  server: InstalledMCPServer;
  onToggle: (installedId: string, enabled: boolean) => void;
  onRemove: (installedId: string) => void;
  onConfigure: (server: InstalledMCPServer) => void;
}) {
  const configuredCount = server.env.filter(envKey => Boolean(server.config?.[envKey])).length;
  return (
    <div className={card}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{server.name}</p>
            <StatusPill tone={server.enabled ? 'success' : 'muted'}>{server.enabled ? 'Enabled' : 'Disabled'}</StatusPill>
            <StatusPill tone={server.availability === 'offline' ? 'success' : 'info'}>{server.availability}</StatusPill>
          </div>
          <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{server.description}</p>
          <p className="mt-3 text-[11px] font-bold text-slate-400 dark:text-slate-500">
            {server.env.length > 0 ? `${configuredCount}/${server.env.length} configuration values set` : 'No API key required'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start">
          {server.env.length > 0 && (
            <button onClick={() => onConfigure(server)} className={iconButton} title="Configure MCP">
              <SettingsIcon className="h-4 w-4" />
            </button>
          )}
          <RowSwitch checked={server.enabled} onChange={enabled => onToggle(server.id, enabled)} label={`Toggle ${server.name}`} />
          <button
            onClick={() => onRemove(server.id)}
            className="rounded-full p-2 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-slate-600 dark:hover:bg-red-500/10 dark:hover:text-red-300"
            title="Remove MCP"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function MCPBrowseCard({ server, installed, onInstall, onConfigure }: {
  server: MCPCatalogServer;
  installed: boolean;
  onInstall: (serverId: string) => void;
  onConfigure: (serverId: string) => void;
}) {
  return (
    <div className={`flex min-h-52 flex-col ${card}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{server.name}</p>
          <p className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-indigo-500 dark:text-indigo-300">{server.category}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill tone={server.availability === 'offline' ? 'success' : 'info'}>{server.availability}</StatusPill>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <Cpu className="h-5 w-5" />
          </div>
        </div>
      </div>
      <p className="flex-1 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{server.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {server.tags.slice(0, 3).map(tag => (
          <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{tag}</span>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="truncate font-mono text-[11px] font-semibold text-slate-400 dark:text-slate-500">{server.command} {server.args[0]}</span>
        <div className="flex shrink-0 items-center gap-2">
          {server.env.length > 0 && (
            <button onClick={() => onConfigure(server.id)} className={iconButton} title="Configure MCP">
              <SettingsIcon className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => onInstall(server.id)} disabled={installed} className={installButton(installed)}>
            {installed ? 'Installed' : 'Install'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToolFeatureRow({ icon, title, description, checked, onChange, actionLabel, meta, onAction }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  actionLabel?: string;
  meta?: string;
  onAction?: () => void;
}) {
  return (
    <div className={card}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-indigo-300">
            <GsapMorphSvg rotate={14} scale={1.2}>
              {icon as React.ReactElement}
            </GsapMorphSvg>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{title}</p>
              {meta && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{meta}</span>}
            </div>
            <p className="mt-1 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
            >
              {actionLabel}
            </button>
          )}
          <RowSwitch checked={checked} onChange={onChange} label={title} />
        </div>
      </div>
    </div>
  );
}

export function ToolInstalledRow({ tool, onToggle, onRemove, onConfigure }: {
  tool: InstalledTool;
  onToggle: (installedId: string, enabled: boolean) => void;
  onRemove: (installedId: string) => void;
  onConfigure: (tool: InstalledTool) => void;
}) {
  const configuredCount = tool.env.filter(envKey => Boolean(tool.config?.[envKey])).length;
  return (
    <div className={card}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{tool.name}</p>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-500 dark:bg-slate-800 dark:text-slate-300">{tool.category}</span>
            <StatusPill tone={tool.enabled ? 'success' : 'muted'}>{tool.enabled ? 'Enabled' : 'Disabled'}</StatusPill>
          </div>
          <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{tool.description}</p>
          <p className="mt-3 text-[11px] font-bold text-slate-400 dark:text-slate-500">
            {tool.env.length > 0 ? `${configuredCount}/${tool.env.length} configuration values set` : 'No API key required'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start">
          {tool.env.length > 0 && (
            <button
              onClick={() => onConfigure(tool)}
              className="rounded-full p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-500 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
              title="Configure Tool"
            >
              <SettingsIcon className="h-4 w-4" />
            </button>
          )}
          <RowSwitch checked={tool.enabled} onChange={enabled => onToggle(tool.id, enabled)} label={`Toggle ${tool.name}`} />
          <button
            onClick={() => onRemove(tool.id)}
            className="rounded-full p-2 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-slate-600 dark:hover:bg-red-500/10 dark:hover:text-red-300"
            title="Remove Tool"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ToolBrowseCard({ tool, installed, onInstall, onConfigure }: {
  tool: (typeof TOOL_CATALOG)[number];
  installed: boolean;
  onInstall: (toolId: string) => void;
  onConfigure: (toolId: string) => void;
}) {
  return (
    <div className={`flex min-h-48 flex-col ${card}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{tool.name}</p>
          <p className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-indigo-500 dark:text-indigo-300">{tool.category}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
          <Search className="h-5 w-5" />
        </div>
      </div>
      <p className="flex-1 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{tool.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tool.tags.slice(0, 3).map(tag => (
          <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{tag}</span>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        {tool.env.length > 0 && (
          <button onClick={() => onConfigure(tool.id)} className={iconButton} title="Configure Tool">
            <SettingsIcon className="h-4 w-4" />
          </button>
        )}
        <button onClick={() => onInstall(tool.id)} disabled={installed} className={installButton(installed)}>
          {installed ? 'Installed' : 'Install'}
        </button>
      </div>
    </div>
  );
}
