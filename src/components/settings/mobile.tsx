'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import NextImage from 'next/image';
import { ArrowLeft, ChevronDown, ChevronRight, ExternalLink, User, Check } from '@/components/ui/icons';
import { type DropdownOption } from '@/components/ui/CustomDropdown';
import { mobileSettingsSections } from './constants';
import type { SettingsIconSource, SettingsTab, UserProfile } from './types';

const getOptionLabel = (options: DropdownOption[], value: string) => {
  const selected = options.find(option => (typeof option === 'string' ? option : option.value) === value);
  return selected ? (typeof selected === 'string' ? selected : selected.label) : value;
};

const MONOCHROME_ICON_TONE = 'bg-[var(--dc-fill)] text-[var(--dc-text-strong)]';

const TAB_ICON_TONE: Record<SettingsTab, string> = {
  account: MONOCHROME_ICON_TONE,
  usage: MONOCHROME_ICON_TONE,
  general: MONOCHROME_ICON_TONE,
  appearance: MONOCHROME_ICON_TONE,
  notifications: MONOCHROME_ICON_TONE,
  voice: MONOCHROME_ICON_TONE,
  personality: MONOCHROME_ICON_TONE,
  keyboard: MONOCHROME_ICON_TONE,
  archived: MONOCHROME_ICON_TONE,
  storage: MONOCHROME_ICON_TONE,
  data: MONOCHROME_ICON_TONE,
};

function useHasPhysicalKeyboard(): boolean {
  const [hasPhysicalKeyboard, setHasPhysicalKeyboard] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const finePointer = window.matchMedia('(any-pointer: fine)');
    const hoverQuery = window.matchMedia('(hover: hover)');
    const sync = () => {
      setHasPhysicalKeyboard(finePointer.matches && hoverQuery.matches);
    };
    sync();
    finePointer.addEventListener('change', sync);
    hoverQuery.addEventListener('change', sync);
    return () => {
      finePointer.removeEventListener('change', sync);
      hoverQuery.removeEventListener('change', sync);
    };
  }, []);

  return hasPhysicalKeyboard;
}

// Mobile-only settings views, stay out on desktop

export function MobileGeneralSelectRow({
  label,
  icon,
  value,
  options,
  onChange,
  menuClassName = 'min-w-[140px]',
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
  const [menuPos, setMenuPos] = useState<{
    top?: number;
    bottom?: number;
    right: number;
    maxHeight: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const label = getOptionLabel(options, value);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || typeof window === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const desiredHeight = Math.min(240, options.length * 42 + 16);
    const openUpward = spaceBelow < desiredHeight && spaceAbove > spaceBelow;
    const availableSpace = openUpward ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(120, Math.min(240, availableSpace - 16));

    setMenuPos({
      top: openUpward ? undefined : rect.bottom + 6,
      bottom: openUpward ? window.innerHeight - rect.top + 6 : undefined,
      right: Math.max(12, window.innerWidth - rect.right),
      maxHeight,
    });
  }, [options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleReposition = () => updatePosition();
    document.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, updatePosition]);

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(current => !current)}
        className="flex min-h-[40px] max-w-[180px] items-center justify-end gap-1.5 rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3 text-right text-[13px] font-medium leading-none text-[var(--dc-text-strong)] outline-none transition-colors hover:bg-[var(--dc-surface-hover)]"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[var(--dc-text-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && menuPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuPos.top,
            bottom: menuPos.bottom,
            right: menuPos.right,
            zIndex: 500,
          }}
          className={`overflow-hidden rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-panel)] py-1.5 shadow-2xl ${menuClassName}`}
        >
          <div style={{ maxHeight: menuPos.maxHeight }} className="overflow-y-auto py-0.5 custom-scrollbar">
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
                      : 'text-[var(--dc-text)] hover:bg-[var(--dc-surface-hover)]'
                  }`}
                >
                  <span className="truncate">{optionLabel}</span>
                  {selected && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--deepchat-accent)]" />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
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
  isGuest = true,
  onClose,
  onOpenTab,
  onOpenProfilePage,
  hidden,
}: {
  profile: UserProfile;
  isGuest?: boolean;
  onClose: () => void;
  onOpenTab: (tab: SettingsTab) => void;
  onOpenProfilePage: () => void;
  hidden: boolean;
}) {
  const hasPhysicalKeyboard = useHasPhysicalKeyboard();
  const guestHiddenTabs = new Set<SettingsTab>(['account', 'usage', 'personality']);

  return (
    <div className={`${hidden ? 'hidden' : 'flex'} h-full flex-col bg-[var(--dc-canvas)] sm:hidden`}>
      {/* Mobile settings top bar */}
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
        {/* Profile header summary, taps straight to /profile */}
        {!isGuest && (
          <button
            type="button"
            onClick={onOpenProfilePage}
            className="mb-7 flex w-full flex-col items-center rounded-2xl py-2 transition-colors active:bg-[var(--dc-surface-hover)]"
          >
            <div className="flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full border-2 border-[var(--dc-border)] bg-indigo-500/12 text-indigo-600 dark:text-indigo-300">
              {profile.avatar ? (
                <NextImage src={profile.avatar} width={76} height={76} unoptimized className="h-full w-full object-cover" alt="User avatar" />
              ) : (
                <User className="h-11 w-11" strokeWidth={2.2} />
              )}
            </div>
            <p className="mt-3 flex max-w-[240px] items-center gap-1.5 truncate text-[18px] font-semibold leading-tight text-[var(--dc-text-strong)]">
              <span className="truncate">{profile.name || 'Guest'}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--dc-text-muted)]" />
            </p>
            <p className="mt-0.5 truncate text-[12.5px] font-medium text-[var(--dc-text-muted)]">
              {profile.plan || 'Free'}
            </p>
          </button>
        )}

        <div className="space-y-6">
          {mobileSettingsSections.map(section => {
            const visibleItems = section.items.filter(
              item =>
                (item.tab !== 'keyboard' || hasPhysicalKeyboard) &&
                (!isGuest || !guestHiddenTabs.has(item.tab))
            );
            if (visibleItems.length === 0) return null;

            return (
              <section key={section.title}>
                <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wider text-[var(--dc-text-muted)]">
                  {section.title}
                </p>
                <div className="overflow-hidden rounded-[20px] border border-[var(--dc-border-subtle)] bg-[var(--dc-surface-muted)] divide-y divide-[var(--dc-border-subtle)]">
                  {visibleItems.map(item => (
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
            );
          })}
        </div>

        <p className="mt-8 pb-2 text-center text-[12px] font-medium text-[var(--dc-text-faint)]">
          DeepChat V1.0.0
        </p>
      </div>
    </div>
  );
}
