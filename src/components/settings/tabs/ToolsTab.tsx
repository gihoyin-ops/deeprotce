'use client';

import React from 'react';
import { ExternalLink, Search } from '@/components/ui/icons';
import type { ToolSettings } from '@/lib/settings/tool-settings';
import { ToolFeatureRow } from '../components';
import { TabHeader } from '../primitives';

interface ToolsTabProps {
  settings: ToolSettings;
  onChange: (patch: Partial<Pick<ToolSettings, 'searchEnabled' | 'urlContextEnabled'>>) => void;
}

// global tool switches with autosave
export function ToolsTab({ settings, onChange }: ToolsTabProps) {
  return (
    <div className="space-y-8">
      <TabHeader title="Tools Settings" description="Control Search and URL Context for chat workflows." />

      <div className="grid grid-cols-1 gap-3">
        <ToolFeatureRow
          icon={<Search className="h-5 w-5" />}
          title="Search"
          description="Automatically searches the web when additional information or recent facts are needed."
          checked={settings.searchEnabled}
          onChange={checked => onChange({ searchEnabled: checked })}
        />
        <ToolFeatureRow
          icon={<ExternalLink className="h-5 w-5" />}
          title="URL Context"
          description="Automatically reads links you include so the assistant can use the provided page content as context."
          checked={settings.urlContextEnabled}
          onChange={checked => onChange({ urlContextEnabled: checked })}
        />
      </div>
    </div>
  );
}
