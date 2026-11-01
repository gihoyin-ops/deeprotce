'use client';

import React from 'react';
import { Bot } from '@/components/ui/icons';
import { TabHeader } from '../primitives';

// placeholder until agent settings are wired
export function AgentTab() {
  return (
    <div className="space-y-8">
      <TabHeader title="Agent Settings" description="Configure autonomous agent behaviors, custom instructions, and skill assignments." />

      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center dark:border-slate-700/60 dark:bg-slate-900/40">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 shadow-xl dark:border-indigo-500/20 dark:bg-indigo-500/15">
          <Bot className="h-10 w-10 text-indigo-500 dark:text-indigo-300" />
        </div>
        <p className="mb-2 text-lg font-extrabold text-slate-800 dark:text-slate-100">Agent settings are still cooking</p>
        <p className="max-w-sm text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
          For now this tab does nothing. Agent behaviours, instructions and skills are still being built.
        </p>
      </div>
    </div>
  );
}
