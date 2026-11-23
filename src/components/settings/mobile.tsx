'use client';

import React, { useEffect, useRef, useState } from 'react';
import NextImage from 'next/image';
import { ArrowLeft, ChevronDown, ChevronRight, User, Check, Edit3 } from '@/components/ui/icons';
import { type DropdownOption } from '@/components/ui/CustomDropdown';
import { mobileSettingsSections } from './constants';
import type { SettingsIconSource, SettingsTab, UserProfile } from './types';

const getOptionLabel = (options: DropdownOption[], value: string) => {
  const selected = options.find(option => (typeof option === 'string' ? option : option.value) === value);
  return selected ? (typeof selected === 'string' ? selected : selected.label) : value;
};

const TAB_ICON_TONE: Record<SettingsTab, string> = {
  account: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400',
  usage: 'bg-cyan-500/12 text-cyan-600 dark:text-cyan-400',
  general: 'bg-slate-500/12 text-slate-700 dark:text-slate-200',
  appearance: 'bg-pink-500/12 text-pink-600 dark:text-pink-400',
  voice: 'bg-sky-500/12 text-sky-600 dark:text-sky-400',
  keyboard: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
  archived: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
  profile: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400',
  notifications: 'bg-amber-500/12 text-amber-600 dark:text-amber-400',
  tools: 'bg-sky-500/12 text-sky-600 dark:text-sky-400',
  agent: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
  personality: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  data: 'bg-blue-500/12 text-blue-600 dark:text-blue-400',
  storage: 'bg-orange-500/12 text-orange-600 dark:text-orange-400',
};

// mobile only views

export function MobileGeneralSelectRow({
  label,
  icon,
  value,
  options,
  onChange,
  menuClassName = 'min-w-[110px]',
}: {
  label: string;
  icon: string;
  value: string;
  options: DropdownOption[];
  position?: 'single' | 'top' | 'middle' | 'bottom';
  onChange: (value: string) => void;
  menuClassName?: string;
}) {
  return (
    <div className="relative">
      <div className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-2 text-[var(--dc-text-strong)]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--dc-surface)] text-[var(--dc-text-strong)] ring-1 ring-[var(--dc-border-subtle)]">
            <IconMask icon={icon} source="local" className="h-[17px] w-[17px] shrink-0" />
          </span>
          <span className="truncate text-[14px] font-semibold leading-none">{label}</span>
        </div>
        <MobileGeneralDropdown
          value={value}
          options={options}
          onChange={onChange}
          menuClassName={menuClassName}
        />
      </div>
    </div>
  );
}

export function MobileProfileSettings({
  profile,
  setProfile,
  isLoading,
  fileInputRef,
  onFileChange,
  onSave,
}: {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  isLoading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
}) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const [editingField, setEditingField] = useState<'name' | 'username' | null>(null);
  const username = profile.plan?.trim() || profile.name.trim().toLowerCase().replace(/\s+/g, '') || 'username';

  useEffect(() => {
    if (editingField === 'name') nameInputRef.current?.focus();
    if (editingField === 'username') usernameInputRef.current?.focus();
  }, [editingField]);

  const updateUsername = (value: string) => {
    setProfile(current => ({ ...current, plan: value.replace(/^@+/, '') }));
  };

  const finishEditing = () => {
    setEditingField(null);
    void onSave();
  };

  const handleEditAction = (field: 'name' | 'username') => {
    if (editingField === field) {
      finishEditing();
      return;
    }
    setEditingField(field);
  };

  return (
    <div className="sm:hidden">
      <div className="mt-4 flex flex-col items-center">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Change avatar"
          className="relative h-[104px] w-[104px] rounded-full transition-transform active:scale-95"
        >
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-[var(--dc-border)] bg-indigo-500/12 text-indigo-600 dark:text-indigo-300">
            {profile.avatar ? (
              <NextImage src={profile.avatar} width={104} height={104} unoptimized className="h-full w-full object-cover" alt="User avatar" />
            ) : (
              <User className="h-14 w-14" strokeWidth={2.2} />
            )}
          </div>
          <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)] text-[var(--dc-text-strong)] shadow-sm">
            <Edit3 className="h-4 w-4" strokeWidth={2.2} />
          </span>
        </button>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={onFileChange}
        />
      </div>

      <section className="mt-8">
        <p className="mb-2.5 px-1 text-[12px] font-semibold uppercase tracking-wider text-[var(--dc-text-muted)]">
          Profile Details
        </p>
        <div className="overflow-hidden rounded-[20px] border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-muted)] divide-y divide-[var(--dc-border-subtle)]">
          <div className="flex min-h-[54px] items-center justify-between px-4 py-1.5 text-[var(--dc-text-strong)]">
            <input
              ref={nameInputRef}
              value={profile.name}
              readOnly={editingField !== 'name'}
              disabled={isLoading}
              onKeyDown={event => {
                if (event.key === 'Enter') finishEditing();
              }}
              onChange={event => setProfile(current => ({ ...current, name: event.target.value }))}
              className={`min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[var(--dc-text-strong)] outline-none disabled:opacity-70 ${editingField === 'name' ? 'cursor-text' : 'cursor-default'}`}
              placeholder="Name"
            />
            <button
              type="button"
              onClick={() => handleEditAction('name')}
              aria-label={editingField === 'name' ? 'Save name' : 'Edit name'}
              className="ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill)]"
            >
              {editingField === 'name' ? <Check className="h-[18px] w-[18px] text-emerald-600" strokeWidth={2.5} /> : <Edit3 className="h-[17px] w-[17px]" strokeWidth={2.2} />}
            </button>
          </div>
          <div className="flex min-h-[54px] items-center justify-between px-4 py-1.5 text-[var(--dc-text-strong)]">
            <div className="flex min-w-0 flex-1 items-center">
              <span className="text-[15px] font-semibold text-[var(--dc-text-muted)]">@</span>
              <input
                ref={usernameInputRef}
                value={username}
                readOnly={editingField !== 'username'}
                disabled={isLoading}
                onKeyDown={event => {
                  if (event.key === 'Enter') finishEditing();
                }}
                onChange={event => updateUsername(event.target.value)}
                className={`min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[var(--dc-text-strong)] outline-none disabled:opacity-70 ${editingField === 'username' ? 'cursor-text' : 'cursor-default'}`}
                placeholder="username"
              />
            </div>
            <button
              type="button"
              onClick={() => handleEditAction('username')}
              aria-label={editingField === 'username' ? 'Save handle' : 'Edit handle'}
              className="ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill)]"
            >
              {editingField === 'username' ? <Check className="h-[18px] w-[18px] text-emerald-600" strokeWidth={2.5} /> : <Edit3 className="h-[17px] w-[17px]" strokeWidth={2.2} />}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function MobileGeneralDropdown({
  value,
  options,
  onChange,
  menuClassName,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  menuClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const label = getOptionLabel(options, value);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={dropdownRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="flex min-h-[44px] max-w-[180px] items-center justify-end gap-1.5 rounded-full px-2 text-right text-[13px] font-medium leading-none text-[var(--dc-text-muted)] outline-none transition-colors hover:text-[var(--dc-text-strong)]"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        className={`absolute right-0 top-full z-[320] mt-1 origin-top-right overflow-hidden rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] py-1.5 shadow-xl transition-[opacity,transform,visibility] duration-150 ease-out ${menuClassName} ${
          open ? 'visible translate-y-0 scale-100 opacity-100' : 'invisible -translate-y-1 scale-95 opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-h-[232px] overflow-y-auto py-0.5 no-scrollbar">
          {options.map(option => {
            const optionValue = typeof option === 'string' ? option : option.value;
            const optionLabel = typeof option === 'string' ? option : option.label;
            const selected = value === optionValue;
            return (
              <button
                key={optionValue}
                type="button"
                onClick={() => {
                  onChange(optionValue);
                  setOpen(false);
                }}
                className={`flex min-h-[40px] w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-[13.5px] font-medium leading-tight transition-colors ${
                  selected
                    ? 'bg-[var(--dc-fill)] font-semibold text-[var(--dc-text-strong)]'
                    : 'text-[var(--dc-text)] hover:bg-[var(--dc-surface-subtle)]'
                }`}
              >
                <span className="truncate">{optionLabel}</span>
                {selected && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--deepchat-accent)]" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const LOCAL_ICON_FALLBACKS: Record<string, string> = {
  'material-symbols:settings-rounded': '/icons/settings.svg',
  'solar:user-bold': '/icons/user.svg',
  'solar:bell-bold': '/icons/bell.svg',
  'tdesign:ai-tool-filled': '/icons/sliders-horizontal.svg',
  'mdi:database-cog': '/icons/database.svg',
  'fluent:storage-24-filled': '/icons/archive.svg',
  'material-symbols:edit-rounded': '/icons/edit-3.svg',
  'material-symbols:check-rounded': '/icons/check.svg',
  'proicons:dark-theme': '/icons/monitor.svg',
  'proicons:contrast': '/icons/sliders-horizontal.svg',
  'carbon:color-palette': '/icons/palette.svg',
  'lucide:languages': '/icons/globe.svg',
};

export function IconMask({ icon, className = 'h-5 w-5' }: { icon: string; source?: SettingsIconSource; className?: string }) {
  const url = LOCAL_ICON_FALLBACKS[icon] || (icon.startsWith('/') ? icon : `/icons/${icon}.svg`);
  return (
    <span
      aria-hidden="true"
      className={`${className} inline-block bg-current`}
      style={{
        WebkitMaskImage: `url("${url}")`,
        maskImage: `url("${url}")`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  );
}

export function MobileSettingsHome({
  profile,
  onClose,
  onOpenTab,
  hidden,
}: {
  profile: UserProfile;
  onClose: () => void;
  onOpenTab: (tab: SettingsTab) => void;
  hidden: boolean;
}) {
  return (
    <div className={`${hidden ? 'hidden' : 'flex'} h-full flex-col bg-[var(--dc-canvas)] sm:hidden`}>
      {/* Unified Mobile Settings Top Bar */}
      <div className="dc-mob-navbar flex min-h-[56px] shrink-0 items-center justify-between px-2 pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="flex h-11 w-11 items-center justify-center rounded-full text-[var(--dc-text-strong)] transition-transform active:scale-90 hover:bg-[var(--dc-fill)]"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
        </button>
        <h2 className="text-[16px] font-semibold tracking-tight text-[var(--dc-text-strong)]">
          Settings
        </h2>
        <div className="h-11 w-11 shrink-0" aria-hidden="true" />
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        {/* Profile Header Summary */}
        <div className="mb-7 flex flex-col items-center">
          <div className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full border-2 border-[var(--dc-border)] bg-indigo-500/12 text-indigo-600 dark:text-indigo-300">
            {profile.avatar ? (
              <NextImage src={profile.avatar} width={76} height={76} unoptimized className="h-full w-full object-cover" alt="User avatar" />
            ) : (
              <User className="h-11 w-11" strokeWidth={2.2} />
            )}
          </div>
          <p className="mt-3 max-w-[240px] truncate text-[18px] font-semibold leading-tight text-[var(--dc-text-strong)]">
            {profile.name || 'Guest'}
          </p>
          <p className="mt-0.5 truncate text-[12.5px] font-medium text-[var(--dc-text-muted)]">
            {profile.plan || 'Personal Plan'}
          </p>
        </div>

        <div className="space-y-6">
          {mobileSettingsSections.map(section => (
            <section key={section.title}>
              <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wider text-[var(--dc-text-muted)]">
                {section.title}
              </p>
              <div className="overflow-hidden rounded-[20px] border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-muted)] divide-y divide-[var(--dc-border-subtle)]">
                {section.items.map(item => (
                  <button
                    key={item.tab}
                    type="button"
                    onClick={() => onOpenTab(item.tab)}
                    className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-2 text-left text-[var(--dc-text-strong)] transition-colors active:bg-[var(--dc-fill)]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${TAB_ICON_TONE[item.tab]}`}>
                        <IconMask icon={item.icon} source={item.source} className="h-[17px] w-[17px] shrink-0" />
                      </span>
                      <span className="truncate text-[14px] font-semibold leading-none">
                        {item.label}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--dc-text-faint)]" strokeWidth={2} />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-8 pb-2 text-center text-[12px] font-medium text-[var(--dc-text-faint)]">
          DeepChat V1.0.0
        </p>
      </div>
    </div>
  );
}
