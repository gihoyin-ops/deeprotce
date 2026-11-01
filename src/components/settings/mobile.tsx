'use client';

import React, { useEffect, useRef, useState } from 'react';
import NextImage from 'next/image';
import { ArrowLeft, ChevronDown, User } from '@/components/ui/icons';
import { type DropdownOption } from '@/components/ui/CustomDropdown';
import { mobileSettingsSections } from './constants';
import type { SettingsIconSource, SettingsTab, UserProfile } from './types';
import { getMobileItemPosition, getMobileItemRadiusClass } from './helpers';

const getOptionLabel = (options: DropdownOption[], value: string) => {
  const selected = options.find(option => (typeof option === 'string' ? option : option.value) === value);
  return selected ? (typeof selected === 'string' ? selected : selected.label) : value;
};

// mobile only views

export function MobileGeneralSelectRow({ label, icon, value, options, position, onChange, menuClassName = 'min-w-[92px]' }: { label: string, icon: string, value: string, options: DropdownOption[], position: 'single' | 'top' | 'middle' | 'bottom', onChange: (value: string) => void, menuClassName?: string }) {
  return (
    <div className="relative">
      <div className={`${getMobileItemRadiusClass(position)} flex h-[51px] w-full items-center justify-between bg-[#d9d9d9] px-4 text-black dark:bg-slate-800 dark:text-slate-100`}>
        <div className="flex min-w-0 items-center gap-[13px]">
          <IconMask icon={icon} source="iconify" className="h-[18px] w-[18px] shrink-0" />
          <span className="truncate text-[12px] font-semibold leading-none">{label}</span>
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

export function MobileProfileSettings({ profile, setProfile, isLoading, fileInputRef, onFileChange, onSave }: { profile: UserProfile, setProfile: React.Dispatch<React.SetStateAction<UserProfile>>, isLoading: boolean, fileInputRef: React.RefObject<HTMLInputElement | null>, onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void, onSave: () => void }) {
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
      <div className="mt-3 flex flex-col items-center">
        <button type="button" onClick={() => fileInputRef.current?.click()} className="relative h-[106px] w-[106px] rounded-full">
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#e7d5ff] text-[#5b44a4]">
            {profile.avatar ? (
              <NextImage src={profile.avatar} width={106} height={106} unoptimized className="h-full w-full object-cover" alt="User avatar" />
            ) : (
              <User className="h-[74px] w-[74px]" strokeWidth={2.5} />
            )}
          </div>
          <span className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#efeeee] text-black shadow-sm">
            <IconMask icon="material-symbols:edit-rounded" source="iconify" className="h-[15px] w-[15px]" />
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

      <section className="mt-12">
        <p className="mb-3 px-3 text-[13px] font-semibold text-[#9b9b9b]">Configurate Profile</p>
        <div className="space-y-[6px]">
          <div className={`${getMobileItemRadiusClass('top')} flex h-[51px] items-center justify-between bg-[#d9d9d9] px-4 text-black dark:bg-slate-800 dark:text-slate-100`}>
            <input
              ref={nameInputRef}
              value={profile.name}
              readOnly={editingField !== 'name'}
              disabled={isLoading}
              onKeyDown={event => {
                if (event.key === 'Enter') finishEditing();
              }}
              onChange={event => setProfile(current => ({ ...current, name: event.target.value }))}
              className={`min-w-0 flex-1 bg-transparent text-[16px] font-semibold text-black outline-none dark:text-slate-100 disabled:opacity-70 ${editingField === 'name' ? 'cursor-text' : 'cursor-default'}`}
              placeholder="Name"
            />
            <button type="button" onClick={() => handleEditAction('name')} className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-black dark:text-slate-300">
              <IconMask icon={editingField === 'name' ? 'material-symbols:check-rounded' : 'material-symbols:edit-rounded'} source="iconify" className="h-[18px] w-[18px]" />
            </button>
          </div>
          <div className={`${getMobileItemRadiusClass('bottom')} flex h-[51px] items-center justify-between bg-[#d9d9d9] px-4 text-black dark:bg-slate-800 dark:text-slate-100`}>
            <div className="flex min-w-0 flex-1 items-center">
              <span className="text-[16px] font-semibold text-black dark:text-slate-300">@</span>
              <input
                ref={usernameInputRef}
                value={username}
                readOnly={editingField !== 'username'}
                disabled={isLoading}
                onKeyDown={event => {
                  if (event.key === 'Enter') finishEditing();
                }}
                onChange={event => updateUsername(event.target.value)}
                className={`min-w-0 flex-1 bg-transparent text-[16px] font-semibold text-black outline-none dark:text-slate-100 disabled:opacity-70 ${editingField === 'username' ? 'cursor-text' : 'cursor-default'}`}
                placeholder="username"
              />
            </div>
            <button type="button" onClick={() => handleEditAction('username')} className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-black dark:text-slate-300">
              <IconMask icon={editingField === 'username' ? 'material-symbols:check-rounded' : 'material-symbols:edit-rounded'} source="iconify" className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function MobileGeneralDropdown({ value, options, onChange, menuClassName }: { value: string, options: DropdownOption[], onChange: (value: string) => void, menuClassName: string }) {
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
        className="flex h-9 max-w-[190px] items-center justify-end gap-1.5 rounded-full px-1 text-right text-[12px] font-medium leading-none text-black outline-none dark:text-slate-100"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`absolute right-0 top-full z-[320] mt-1 origin-top-right overflow-hidden rounded-[14px] bg-[#e2e2e2] py-1 shadow-[0_10px_24px_rgba(0,0,0,0.18)] dark:bg-slate-800 transition-[opacity,transform,visibility] duration-150 ease-out ${menuClassName} ${open ? 'visible translate-y-0 scale-100 opacity-100' : 'invisible -translate-y-1 scale-95 opacity-0 pointer-events-none'}`}>
        <div className="max-h-[232px] overflow-y-auto py-0.5 no-scrollbar">
          {options.map(option => {
            const optionValue = typeof option === 'string' ? option : option.value;
            const optionLabel = typeof option === 'string' ? option : option.label;
            return (
              <button
                key={optionValue}
                type="button"
                onClick={() => {
                  onChange(optionValue);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-1.5 text-left text-[13px] font-medium leading-tight transition-colors ${value === optionValue ? 'text-black dark:text-slate-100' : 'text-black/80 hover:bg-white/45 hover:text-black dark:text-slate-300 dark:hover:bg-slate-700/70 dark:hover:text-white'}`}
              >
                {optionLabel}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


export function IconMask({ icon, source, className = 'h-5 w-5' }: { icon: string, source: SettingsIconSource, className?: string }) {
  const url = source === 'iconify' ? `https://api.iconify.design/${icon}.svg` : icon;
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
        maskSize: 'contain'
      }}
    />
  );
}

export function MobileSettingsHome({ profile, onClose, onOpenTab, hidden }: { profile: UserProfile, onClose: () => void, onOpenTab: (tab: SettingsTab) => void, hidden: boolean }) {
  return (
    <div className={`${hidden ? 'hidden' : 'flex'} h-full flex-col bg-white px-3 pb-6 pt-2 sm:hidden`}>
      <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#efeeee] text-black dark:bg-slate-800 dark:text-slate-200 transition-transform active:scale-95" aria-label="Close settings">
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
      </button>

      <div className="mt-1 flex flex-col items-center">
        <div className="flex h-[78px] w-[78px] items-center justify-center overflow-hidden rounded-full bg-[#e7d5ff] text-[#5b44a4]">
          {profile.avatar ? (
            <NextImage src={profile.avatar} width={78} height={78} unoptimized className="h-full w-full object-cover" alt="User avatar" />
          ) : (
            <User className="h-12 w-12" strokeWidth={2.5} />
          )}
        </div>
        <p className="mt-3 max-w-[240px] truncate text-[18px] font-semibold leading-none text-black dark:text-slate-100">{profile.name || 'Guest'}</p>
      </div>

      <div className="mt-10 flex-1 overflow-y-auto pb-6 no-scrollbar">
        <div className="space-y-6">
          {mobileSettingsSections.map(section => (
            <section key={section.title}>
              <p className="mb-2 px-1 text-[12px] font-semibold text-[#9b9b9b]">{section.title}</p>
              <div className="space-y-[6px]">
                {section.items.map((item, index) => {
                  const position = getMobileItemPosition(section.title, index, section.items.length);
                  const extraGap = section.title === 'Model & Services' && index === 5 ? 'mt-3' : '';
                  return (
                    <button
                      key={item.tab}
                      type="button"
                      onClick={() => onOpenTab(item.tab)}
                      className={`${extraGap} flex h-[51px] w-full items-center gap-[13px] ${getMobileItemRadiusClass(position)} bg-[#d9d9d9] px-4 text-left text-black dark:bg-slate-800 dark:text-slate-100 transition-transform active:scale-[0.99]`}
                    >
                      <IconMask icon={item.icon} source={item.source} className="h-[18px] w-[18px] shrink-0" />
                      <span className="truncate text-[12px] font-semibold leading-none">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <p className="shrink-0 text-center text-[12px] font-medium text-[#9b9b9b]">DeepChat V1.0.0</p>
    </div>
  );
}

