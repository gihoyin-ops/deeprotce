'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Search, Settings as SettingsIcon } from '@/components/ui/icons';
import { updateMCPServerConfig, type InstalledMCPServer, type MCPSettings } from '@/lib/mcp/mcp-settings';
import { updateToolConfig, type InstalledTool, type ToolSettings } from '@/lib/settings/tool-settings';
import { Dialog, DialogHeader, dialogBody } from '../dialog';

const envInput = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500';
const cancelButton = 'flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800';
const saveButton = 'flex-1 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition-colors hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400';

const isSecretKey = (key: string) => ['TOKEN', 'SECRET', 'PASSWORD', 'KEY'].some(marker => key.includes(marker));

// env config rows
function EnvField({ envKey, value, onChange }: { envKey: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-extrabold text-slate-600 dark:text-slate-300">{envKey}</label>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        type={isSecretKey(envKey) ? 'password' : 'text'}
        placeholder={`Enter ${envKey}`}
        className={envInput}
      />
    </div>
  );
}

interface EnvDialogProps {
  title: string;
  category: string;
  description: string;
  envKeys: string[];
  command?: string;
  icon: React.ReactNode;
  initialValues: Record<string, string>;
  zIndex: number;
  closing: boolean;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}

// shared config dialog layout
export function EnvConfigDialog({ title, category, description, envKeys, command, icon, initialValues, zIndex, closing, onClose, onSave }: EnvDialogProps) {
  const [draft, setDraft] = useState<Record<string, string>>(initialValues);

  return (
    <Dialog open closing={closing} zIndex={zIndex} width="max-w-xl" onClose={onClose}>
      <DialogHeader title={title} description={undefined} onClose={onClose} icon={icon} />
      <div className={dialogBody}>
        <div className="mb-1 text-xs font-bold text-slate-500 dark:text-slate-400">{category}</div>
        <p className="mb-5 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
        {command && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/60 dark:bg-slate-900/40">
            <p className="mb-1 text-xs font-extrabold text-slate-500 dark:text-slate-400">Command</p>
            <p className="break-all font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{command}</p>
          </div>
        )}
        {envKeys.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700/60 dark:bg-slate-900/40">
            <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />
            <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">No configuration needed</p>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">This one can run without environment keys.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {envKeys.map(envKey => (
              <EnvField key={envKey} envKey={envKey} value={draft[envKey] || ''} onChange={value => setDraft(prev => ({ ...prev, [envKey]: value }))} />
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-3 border-t border-slate-100 p-4 dark:border-slate-700/60 sm:p-6">
        <button onClick={onClose} className={cancelButton}>Cancel</button>
        <button onClick={() => onSave(draft)} className={saveButton}>Save Configuration</button>
      </div>
    </Dialog>
  );
}

// server config wrappers
export function MCPConfigDialog({ server, closing, onClose, onSaved }: {
  server: InstalledMCPServer;
  closing: boolean;
  onClose: () => void;
  onSaved: (next: MCPSettings) => void;
}) {
  return (
    <EnvConfigDialog
      title={`Configure ${server.name}`}
      category={server.category}
      description={server.description}
      envKeys={server.env}
      command={`${server.command} ${server.args.join(' ')}`.trim()}
      icon={<SettingsIcon className="h-5 w-5" />}
      initialValues={server.config || {}}
      zIndex={360}
      closing={closing}
      onClose={onClose}
      onSave={values => {
        onSaved(updateMCPServerConfig(server.id, values));
        toast.success('MCP configuration saved');
        onClose();
      }}
    />
  );
}

export function ToolConfigDialog({ tool, closing, onClose, onSaved }: {
  tool: InstalledTool;
  closing: boolean;
  onClose: () => void;
  onSaved: (next: ToolSettings) => void;
}) {
  return (
    <EnvConfigDialog
      title={`Configure ${tool.name}`}
      category={tool.category}
      description={tool.description}
      envKeys={tool.env}
      icon={<Search className="h-5 w-5" />}
      initialValues={tool.config || {}}
      zIndex={360}
      closing={closing}
      onClose={onClose}
      onSave={values => {
        onSaved(updateToolConfig(tool.id, values));
        toast.success('Tool configuration saved');
        onClose();
      }}
    />
  );
}
