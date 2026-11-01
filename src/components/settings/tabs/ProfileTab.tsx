'use client';

import React from 'react';
import NextImage from 'next/image';
import { Plus } from '@/components/ui/icons';
import { MobileProfileSettings } from '../mobile';
import { PrimaryButton, TabHeader, SettingsPanel } from '../primitives';
import type { UserProfile } from '../types';

interface ProfileTabProps {
  profile: UserProfile;
  isLoading: boolean;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  onSave: () => void;
  onAvatarPicked: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

// user profile settings
export function ProfileTab({ profile, isLoading, setProfile, onSave, onAvatarPicked, fileInputRef }: ProfileTabProps) {
  const fallbackAvatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix';

  return (
    <>
      <MobileProfileSettings
        profile={profile}
        setProfile={setProfile}
        isLoading={isLoading}
        fileInputRef={fileInputRef}
        onFileChange={onAvatarPicked}
        onSave={onSave}
      />
      <div className="hidden space-y-6 sm:block">
        <TabHeader title="Profile Settings" description="Customize your profile name, avatar, and plan display." />
        <SettingsPanel className="space-y-5! p-4 sm:p-5">
          <div className="mb-2 flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="group relative cursor-pointer rounded-full"
              aria-label="Change avatar"
            >
              <NextImage
                src={profile.avatar || fallbackAvatar}
                width={64}
                height={64}
                unoptimized
                className="h-16 w-16 rounded-full border-4 border-white bg-slate-100 object-cover shadow-sm dark:border-slate-700/60"
                alt="Avatar"
              />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Plus className="h-6 w-6 text-white" />
              </span>
            </button>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-slate-800 dark:text-slate-100">{isLoading ? 'Loading profile...' : profile.name || 'Guest'}</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{profile.plan || 'No Plan'}</p>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Profile Name</label>
            <input
              type="text"
              value={profile.name}
              onChange={event => setProfile({ ...profile, name: event.target.value })}
              disabled={isLoading}
              className="deepchat-field"
              placeholder="e.g. Alex Morgan"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-300">Plan</label>
            <input
              type="text"
              value={profile.plan}
              onChange={event => setProfile({ ...profile, plan: event.target.value })}
              disabled={isLoading}
              className="deepchat-field"
              placeholder="e.g. Free, Pro, Team"
            />
          </div>

          <PrimaryButton onClick={onSave}>Save Profile</PrimaryButton>
        </SettingsPanel>
      </div>
    </>
  );
}
