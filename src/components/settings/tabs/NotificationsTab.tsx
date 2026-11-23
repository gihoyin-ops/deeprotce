'use client';

import React from 'react';
import { NOTIFICATION_EVENT_KEYS } from '../constants';
import { PillDropdown, type PillDropdownOption } from '../PillDropdown';
import type {
  NotificationEventKey,
  NotificationEventSetting,
  NotificationSettings
} from '@/lib/settings/notification-settings';

interface NotificationsTabProps {
  settings: NotificationSettings;
  pushPermission: 'default' | 'denied' | 'granted' | 'unsupported';
  onChange: (patch: Partial<NotificationSettings>) => void;
  onQuietHoursChange: (patch: Partial<NotificationSettings['quietHours']>) => void;
  onEventChange: (key: NotificationEventKey, patch: Partial<NotificationEventSetting>) => void;
  onEnablePush: () => void;
  onSendTest: () => void;
}

const CHANNEL_OPTIONS: PillDropdownOption[] = [
  { label: 'Off', value: 'off' },
  { label: 'In-app', value: 'in-app' },
  { label: 'Push', value: 'push' },
  { label: 'Push, In-app', value: 'push-inapp' },
  { label: 'Push, In-app, Sound', value: 'all' }
];

const EVENT_META: Record<NotificationEventKey, { title: string; description: string }> = {
  responseFinished: {
    title: 'Responses',
    description: 'Get notified when a background AI response is ready.'
  },
  task: {
    title: 'Tasks & workflows',
    description: 'Get notified about background task completion, failures, and status.'
  },
  usage: {
    title: 'Usage & plan limits',
    description: 'Get notified when token usage nears or reaches your plan limit.'
  },
  agent: {
    title: 'Agent activity',
    description: 'Get notified when an agent needs your input, approval, or attention.'
  }
};

function settingToOptionValue(setting: NotificationEventSetting): string {
  if (!setting.enabled || (!setting.inApp && !setting.push && !setting.sound)) return 'off';
  if (setting.push && setting.inApp && setting.sound) return 'all';
  if (setting.push && setting.inApp) return 'push-inapp';
  if (setting.push) return 'push';
  return 'in-app';
}

function optionValueToPatch(value: string): Partial<NotificationEventSetting> {
  switch (value) {
    case 'off':
      return { enabled: false, inApp: false, push: false, sound: false };
    case 'in-app':
      return { enabled: true, inApp: true, push: false, sound: false };
    case 'push':
      return { enabled: true, inApp: false, push: true, sound: false };
    case 'push-inapp':
      return { enabled: true, inApp: true, push: true, sound: false };
    case 'all':
      return { enabled: true, inApp: true, push: true, sound: true };
    default:
      return { enabled: true, inApp: true, push: false, sound: false };
  }
}

export function NotificationsTab({
  settings,
  pushPermission,
  onChange,
  onEventChange,
  onEnablePush
}: NotificationsTabProps) {
  const handleSelect = (key: NotificationEventKey, value: string) => {
    const patch = optionValueToPatch(value);
    if (!settings.enabled && patch.enabled) {
      onChange({ enabled: true });
    }
    if (patch.inApp && !settings.inAppEnabled) {
      onChange({ inAppEnabled: true });
    }
    if (patch.sound && !settings.soundEnabled) {
      onChange({ soundEnabled: true });
    }
    if (patch.push) {
      if (!settings.pushEnabled) onChange({ pushEnabled: true });
      if (pushPermission === 'default') onEnablePush();
    }
    onEventChange(key, patch);
  };

  return (
    <div className="space-y-8">
      <header className="hidden sm:block">
        <h3 className="text-2xl font-semibold tracking-tight text-[var(--dc-text-strong)]">Notifications</h3>
        <p className="mt-1 text-sm text-[var(--dc-text-muted)]">
          Choose how you want to be notified about DeepChat activity
        </p>
      </header>

      <section>
        <h4 className="border-b border-[var(--dc-border-subtle)] pb-3 text-base font-medium text-[var(--dc-text-strong)]">
          DeepChat notifications
        </h4>

        <div className="divide-y divide-[var(--dc-border-subtle)]">
          {NOTIFICATION_EVENT_KEYS.map(key => {
            const meta = EVENT_META[key];
            const currentValue = settingToOptionValue(settings.events[key]);
            return (
              <div key={key} className="flex items-center justify-between gap-4 py-4 sm:gap-6">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--dc-text-strong)]">{meta.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--dc-text-muted)]">{meta.description}</p>
                </div>
                <PillDropdown
                  value={currentValue}
                  options={CHANNEL_OPTIONS}
                  onChange={val => handleSelect(key, val)}
                  ariaLabel={`${meta.title} notification channel`}
                />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
