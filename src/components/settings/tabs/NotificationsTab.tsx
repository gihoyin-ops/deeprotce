'use client';

import React from 'react';
import { BellRing, Monitor, Volume2 } from '@/components/ui/icons';
import { NOTIFICATION_EVENT_KEYS } from '../constants';
import { ChannelToggle, IconToggleRow, SettingsPanel, TabHeader } from '../primitives';
import { notificationEventLabels, type NotificationEventKey, type NotificationEventSetting, type NotificationSettings } from '@/lib/settings/notification-settings';

interface NotificationsTabProps {
  settings: NotificationSettings;
  pushPermission: 'default' | 'denied' | 'granted' | 'unsupported';
  onChange: (patch: Partial<NotificationSettings>) => void;
  onQuietHoursChange: (patch: Partial<NotificationSettings['quietHours']>) => void;
  onEventChange: (key: NotificationEventKey, patch: Partial<NotificationEventSetting>) => void;
  onEnablePush: () => void;
  onSendTest: () => void;
}

const outlineButton = 'rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300';
const timeField = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-100';

// notification toggles, event rules, and quiet hours
export function NotificationsTab({ settings, pushPermission, onChange, onQuietHoursChange, onEventChange, onEnablePush, onSendTest }: NotificationsTabProps) {
  return (
    <div className="space-y-6">
      <TabHeader title="Notification Settings" description="Control inbox, push, and sound alerts for background events." />

      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <IconToggleRow icon={<BellRing className="h-5 w-5" />} title="Notifications" description="Master switch for every alert channel." checked={settings.enabled} onChange={checked => onChange({ enabled: checked })} />
          <IconToggleRow icon={<Monitor className="h-5 w-5" />} title="In-app inbox" description="Save alerts in the bell menu." checked={settings.inAppEnabled} onChange={checked => onChange({ inAppEnabled: checked })} />
          <IconToggleRow icon={<Volume2 className="h-5 w-5" />} title="Sound" description="Play a subtle tone for selected notification types." checked={settings.soundEnabled} onChange={checked => onChange({ soundEnabled: checked })} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Push notifications</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                Browser notifications for background responses. Current permission: {pushPermission}.
              </p>
            </div>
            <button
              type="button"
              onClick={onEnablePush}
              className="shrink-0 rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              {pushPermission === 'granted' ? 'Enabled' : 'Enable'}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <IconToggleRow title="Use push" description="Allow event rules to send browser notifications." checked={settings.pushEnabled} onChange={checked => onChange({ pushEnabled: checked })} />
            <IconToggleRow title="Only when away" description="Avoid push alerts while this tab is visible." checked={settings.onlyPushWhenAway} onChange={checked => onChange({ onlyPushWhenAway: checked })} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100">Delivery rules</h4>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Choose inbox, push, and sound behavior for each event type.</p>
          </div>
          <button type="button" onClick={onSendTest} className={outlineButton}>Send test</button>
        </div>

        <div className="space-y-3">
          {NOTIFICATION_EVENT_KEYS.map(key => (
            <EventRow
              key={key}
              label={notificationEventLabels[key].title}
              description={notificationEventLabels[key].description}
              setting={settings.events[key]}
              onChange={patch => onEventChange(key, patch)}
            />
          ))}
        </div>
      </section>

      <SettingsPanel>
        <div>
          <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100">Inbox and quiet hours</h4>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Tune storage and silence non-urgent alerts during focus time.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <IconToggleRow title="Group by chat" description="Use one push thread per chat when supported." checked={settings.groupByChat} onChange={checked => onChange({ groupByChat: checked })} />
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-100">Max inbox items</label>
            <input
              type="number"
              min={10}
              max={200}
              value={settings.maxInboxItems}
              onChange={event => onChange({ maxInboxItems: Number(event.target.value) })}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-100"
            />
          </div>
          <IconToggleRow title="Quiet hours" description="Mute push and sound during a time range." checked={settings.quietHours.enabled} onChange={checked => onQuietHoursChange({ enabled: checked })} />
          <IconToggleRow title="Allow errors" description="Let failed responses bypass quiet hours." checked={settings.quietHours.allowErrors} onChange={checked => onQuietHoursChange({ allowErrors: checked })} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">Start</label>
            <input type="time" value={settings.quietHours.start} onChange={event => onQuietHoursChange({ start: event.target.value })} className={timeField} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">End</label>
            <input type="time" value={settings.quietHours.end} onChange={event => onQuietHoursChange({ end: event.target.value })} className={timeField} />
          </div>
        </div>
      </SettingsPanel>
    </div>
  );
}

function EventRow({ label, description, setting, onChange }: {
  label: string;
  description: string;
  setting: NotificationEventSetting;
  onChange: (patch: Partial<NotificationEventSetting>) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/60">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{label}</p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <ChannelToggle label={setting.enabled ? 'On' : 'Off'} checked={setting.enabled} onChange={checked => onChange({ enabled: checked })} />
      </div>
      <div className={`mt-4 flex flex-wrap gap-2 ${setting.enabled ? '' : 'pointer-events-none opacity-50'}`}>
        <ChannelToggle label="Inbox" checked={setting.inApp} onChange={checked => onChange({ inApp: checked })} />
        <ChannelToggle label="Push" checked={setting.push} onChange={checked => onChange({ push: checked })} />
        <ChannelToggle label="Sound" checked={setting.sound} onChange={checked => onChange({ sound: checked })} />
      </div>
    </div>
  );
}
