'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gsap } from 'gsap';
import toast from 'react-hot-toast';
import { PillDropdown } from '@/components/settings/PillDropdown';
import {
  ArrowLeft,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2
} from '@/components/ui/icons';
import { formatRoleLabel, isManagerStaffRole, type AccountRole } from '@/lib/security/roles';
import { safeAvatarSource } from '@/lib/utils';
import { ActionReasonModal, type PendingAdminAction } from './ActionReasonModal';
import { AddUserModal } from './AddUserModal';
import { SubscriptionModal } from './SubscriptionModal';
import type { AdminOverviewResponse, AdminUserItem } from './types';

type AdminTab = 'users' | 'audit';

const ROLE_FILTER_OPTIONS = [
  { label: 'All roles', value: 'all' },
  { label: 'User', value: 'user' },
  { label: 'Staff', value: 'staff' },
  { label: 'Manager Staff', value: 'manager_staff' }
];

const STATUS_FILTER_OPTIONS = [
  { label: 'All status', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Banned', value: 'banned' }
];

const ROLE_OPTIONS = [
  { label: 'User', value: 'user' },
  { label: 'Staff', value: 'staff' },
  { label: 'Manager Staff', value: 'manager_staff' }
];

const PLAN_OPTIONS = [
  { label: 'Free', value: 'free' },
  { label: 'Supporters', value: 'supporters' },
  { label: 'Cools', value: 'cool' }
];

const formatShortDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const formatDateTime = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const planLabel = (plan: string) => {
  const p = plan.trim().toLowerCase();
  if (p === 'cool') return 'Cools';
  if (p === 'supporters') return 'Supporters';
  return 'Free';
};

export default function AdminPanelClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<AdminTab>('users');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AccountRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAdminAction | null>(null);
  const [subTarget, setSubTarget] = useState<AdminUserItem | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);
  const tabIndicatorRef = useRef<HTMLSpanElement>(null);
  const tabButtonRefs = useRef<Record<AdminTab, HTMLButtonElement | null>>({
    users: null,
    audit: null
  });
  const didAnimateEntrance = useRef(false);

  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const res = await fetch('/api/admin/overview', { credentials: 'same-origin' });
      const json = (await res.json()) as AdminOverviewResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load admin panel');
      }
      return json;
    },
    staleTime: 15_000
  });

  // Entrance stagger with GSAP
  useEffect(() => {
    if (!data || didAnimateEntrance.current || !rootRef.current) return;
    didAnimateEntrance.current = true;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.admin-stat-card',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.34, stagger: 0.05, ease: 'power3.out' }
      );
      gsap.fromTo(
        '.admin-row-anim',
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.28, stagger: 0.025, ease: 'power2.out', delay: 0.08 }
      );
    }, rootRef);

    return () => ctx.revert();
  }, [data]);

  // Sliding tab indicator + content fade with GSAP
  useEffect(() => {
    const activeBtn = tabButtonRefs.current[tab];
    const indicator = tabIndicatorRef.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (activeBtn && indicator) {
      const targetProps = { x: activeBtn.offsetLeft, width: activeBtn.offsetWidth };
      if (reduce) {
        gsap.set(indicator, targetProps);
      } else {
        gsap.to(indicator, { ...targetProps, duration: 0.26, ease: 'power3.out' });
      }
    }

    if (tabContentRef.current && !reduce) {
      gsap.fromTo(
        tabContentRef.current,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out' }
      );
    }
  }, [tab, isPending]);

  const isManager = isManagerStaffRole(data?.actor.role);

  const filteredUsers = useMemo(() => {
    const users = data?.users ?? [];
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (q) {
        const hay = `${u.email} ${u.username ?? ''} ${u.displayName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter === 'banned' && !u.isBanned) return false;
      if (statusFilter === 'active' && u.isBanned) return false;
      return true;
    });
  }, [data?.users, search, roleFilter, statusFilter]);

  const invalidateOverview = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
  };

  const handleConfirmAction = async (reason: string) => {
    if (!pendingAction) return;
    const target = pendingAction.user;

    try {
      if (pendingAction.kind === 'delete') {
        const res = await fetch(`/api/admin/users/${encodeURIComponent(target.id)}`, {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ reason })
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          toast.error(json.error || 'Failed to delete user');
          return;
        }
        toast.success(`Deleted ${target.email}`);
      } else {
        const payload =
          pendingAction.kind === 'ban'
            ? { action: 'ban', reason }
            : pendingAction.kind === 'unban'
              ? { action: 'unban', reason }
              : pendingAction.kind === 'update_role'
                ? { action: 'update_role', role: pendingAction.nextRole, reason }
                : { action: 'update_plan', plan: pendingAction.nextPlan, reason };

        const res = await fetch(`/api/admin/users/${encodeURIComponent(target.id)}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(payload)
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          toast.error(json.error || 'Action failed');
          return;
        }
        toast.success('Updated');
      }

      setPendingAction(null);
      await invalidateOverview();
    } catch {
      toast.error('Network error while applying change');
    }
  };

  const handleRevokeSessions = async (user: AdminUserItem) => {
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'revoke_sessions',
          reason: 'Forced session revocation via Admin Panel'
        })
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error || 'Failed to revoke sessions');
        return;
      }
      toast.success(`Signed out ${user.email}`);
      await invalidateOverview();
    } catch {
      toast.error('Network error');
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--dc-canvas)] p-6">
        <div className="w-full max-w-md rounded-3xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-6 text-center shadow-xl">
          <ShieldAlert className="mx-auto h-8 w-8 text-[var(--dc-text-muted)]" />
          <h1 className="mt-3 text-lg font-semibold text-[var(--dc-text-strong)]">
            Access unavailable
          </h1>
          <p className="mt-1 text-sm text-[var(--dc-text-muted)]">
            {error instanceof Error ? error.message : 'Unable to load admin panel.'}
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mt-5 rounded-full bg-[var(--dc-invert)] px-5 py-2 text-sm font-medium text-[var(--dc-text-on-invert)]"
          >
            Back to Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="min-h-screen bg-[var(--dc-canvas)] text-[var(--dc-text)]">
      {/* Clean top navbar — zero extra tags or clutter */}
      <header className="sticky top-0 z-30 border-b border-[var(--dc-border-subtle)] bg-[var(--dc-canvas)]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/')}
              aria-label="Back to chat"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-surface-hover)] active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-base font-semibold tracking-tight text-[var(--dc-text-strong)] sm:text-lg">
              Admin
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              aria-label="Refresh"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)] active:scale-95"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>

            {isManager && (
              <button
                type="button"
                onClick={() => setIsAddOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--dc-invert)] px-4 text-xs font-medium text-[var(--dc-text-on-invert)] transition-opacity hover:opacity-90 active:scale-[0.98] sm:text-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Add user</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {[
            { label: 'Accounts', value: data?.stats.totalUsers ?? '—' },
            { label: 'Staff', value: data?.stats.activeStaff ?? '—' },
            { label: 'Paid plans', value: data?.stats.paidUsers ?? '—' },
            { label: 'Suspended', value: data?.stats.bannedUsers ?? '—' }
          ].map(stat => (
            <div
              key={stat.label}
              className="admin-stat-card rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] px-4 py-3.5"
            >
              <p className="text-xs font-medium text-[var(--dc-text-muted)]">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-[var(--dc-text-strong)]">
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        {/* Sliding-indicator Tabs */}
        <div className="relative flex items-center gap-1 border-b border-[var(--dc-border-subtle)]">
          {(
            [
              { id: 'users', label: `Users (${data?.users.length ?? 0})` },
              { id: 'audit', label: `Audit log (${data?.auditLogs.length ?? 0})` }
            ] as const
          ).map(item => (
            <button
              key={item.id}
              ref={el => {
                tabButtonRefs.current[item.id] = el;
              }}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === item.id
                  ? 'text-[var(--dc-text-strong)]'
                  : 'text-[var(--dc-text-muted)] hover:text-[var(--dc-text-strong)]'
              }`}
            >
              {item.label}
            </button>
          ))}
          <span
            ref={tabIndicatorRef}
            className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-[var(--dc-text-strong)]"
            style={{ width: 0 }}
          />
        </div>

        <div ref={tabContentRef}>
          {isPending ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)]"
                />
              ))}
            </div>
          ) : tab === 'users' ? (
            <div className="space-y-4">
              {/* Search & PillDropdown Filters */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 sm:max-w-sm">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dc-text-muted)]" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search email, username, or name..."
                    className="h-10 w-full rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)] pl-10 pr-4 text-sm text-[var(--dc-text-strong)] outline-none transition-colors focus:border-[var(--deepchat-accent)]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <PillDropdown
                    value={roleFilter}
                    onChange={v => setRoleFilter(v as 'all' | AccountRole)}
                    options={ROLE_FILTER_OPTIONS}
                    align="left"
                    ariaLabel="Filter by role"
                  />
                  <PillDropdown
                    value={statusFilter}
                    onChange={v => setStatusFilter(v as 'all' | 'active' | 'banned')}
                    options={STATUS_FILTER_OPTIONS}
                    align="right"
                    ariaLabel="Filter by status"
                  />
                </div>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="rounded-3xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] py-12 text-center text-sm text-[var(--dc-text-muted)]">
                  No accounts match your filter.
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden overflow-hidden rounded-3xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] md:block">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--dc-border-subtle)] text-xs font-medium text-[var(--dc-text-muted)]">
                          <th className="px-5 py-3.5">Account</th>
                          <th className="px-4 py-3.5">Role</th>
                          <th className="px-4 py-3.5">Plan</th>
                          <th className="px-4 py-3.5">Status</th>
                          <th className="px-4 py-3.5">Joined</th>
                          <th className="px-5 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--dc-border-subtle)]">
                        {filteredUsers.map(user => {
                          const isSelf = user.id === data?.actor.id;
                          const canChangePlan = isManager || user.role === 'user';
                          const currentPlan =
                            user.plan === 'supporters' || user.plan === 'cool'
                              ? user.plan
                              : 'free';

                          return (
                            <tr
                              key={user.id}
                              className="admin-row-anim transition-colors hover:bg-[var(--dc-surface-hover)]/45"
                            >
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={safeAvatarSource(user.avatarUrl)}
                                    alt={user.displayName}
                                    className="h-9 w-9 shrink-0 rounded-full border border-[var(--dc-border)] object-cover"
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="truncate font-medium text-[var(--dc-text-strong)]">
                                        {user.displayName}
                                      </span>
                                      {isSelf && (
                                        <span className="rounded-full bg-[var(--dc-fill)] px-2 py-0.5 text-[10px] font-medium text-[var(--dc-text-muted)]">
                                          You
                                        </span>
                                      )}
                                    </div>
                                    <p className="truncate font-mono text-xs text-[var(--dc-text-muted)]">
                                      {user.email}
                                      {user.username ? ` · @${user.username}` : ''}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-3.5">
                                {isManager && !isSelf ? (
                                  <PillDropdown
                                    value={user.role}
                                    onChange={v => {
                                      const nextRole = v as AccountRole;
                                      if (nextRole !== user.role) {
                                        setPendingAction({ kind: 'update_role', user, nextRole });
                                      }
                                    }}
                                    options={ROLE_OPTIONS}
                                    align="left"
                                    ariaLabel={`Change role for ${user.email}`}
                                  />
                                ) : (
                                  <span className="inline-flex rounded-full border border-[var(--dc-border)] bg-[var(--dc-panel)] px-3 py-1 text-xs font-medium text-[var(--dc-text-strong)]">
                                    {formatRoleLabel(user.role)}
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3.5">
                                {canChangePlan ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <PillDropdown
                                        value={currentPlan}
                                        onChange={v => {
                                          const nextPlan = v as 'free' | 'supporters' | 'cool';
                                          if (nextPlan !== user.plan) {
                                            setPendingAction({ kind: 'update_plan', user, nextPlan });
                                          }
                                        }}
                                        options={PLAN_OPTIONS}
                                        align="left"
                                        ariaLabel={`Change plan for ${user.email}`}
                                      />
                                      {(currentPlan === 'supporters' || currentPlan === 'cool') && (
                                        <button
                                          type="button"
                                          onClick={() => setSubTarget(user)}
                                          className="rounded-full border border-[var(--dc-border)] bg-[var(--dc-panel)] px-2.5 py-1 text-xs font-medium text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
                                        >
                                          Duration
                                        </button>
                                      )}
                                    </div>
                                    {(currentPlan === 'supporters' || currentPlan === 'cool') && (
                                      <p className="pl-1 text-[11px] text-[var(--dc-text-muted)]">
                                        {user.subscription?.validUntil
                                          ? `Exp ${formatShortDate(user.subscription.validUntil)}`
                                          : 'Lifetime'}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-[var(--dc-text-muted)]">
                                    {planLabel(user.plan)}
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3.5">
                                {user.isBanned ? (
                                  <div>
                                    <span className="inline-flex rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                                      Banned
                                    </span>
                                    {user.banReason && (
                                      <p
                                        title={user.banReason}
                                        className="mt-1 max-w-[160px] truncate text-[11px] text-[var(--dc-text-muted)]"
                                      >
                                        {user.banReason}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-xs text-[var(--dc-text-muted)]">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    <span>Active</span>
                                    {user.activeSessions > 0 && (
                                      <span className="text-[11px] opacity-75">
                                        ({user.activeSessions})
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-3.5 text-xs text-[var(--dc-text-muted)]">
                                {formatShortDate(user.createdAt)}
                              </td>

                              <td className="px-5 py-3.5 text-right">
                                {isManager && !isSelf ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    {user.activeSessions > 0 && !user.isBanned && (
                                      <button
                                        type="button"
                                        onClick={() => void handleRevokeSessions(user)}
                                        className="rounded-full border border-[var(--dc-border)] px-3 py-1 text-xs font-medium text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
                                      >
                                        Kick
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPendingAction({
                                          kind: user.isBanned ? 'unban' : 'ban',
                                          user
                                        })
                                      }
                                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                        user.isBanned
                                          ? 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400'
                                          : 'border-amber-500/30 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400'
                                      }`}
                                    >
                                      {user.isBanned ? 'Unban' : 'Ban'}
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Delete ${user.email}`}
                                      onClick={() => setPendingAction({ kind: 'delete', user })}
                                      className="rounded-full p-1.5 text-[var(--dc-text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-[var(--dc-text-muted)]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="space-y-3 md:hidden">
                    {filteredUsers.map(user => {
                      const isSelf = user.id === data?.actor.id;
                      const canChangePlan = isManager || user.role === 'user';
                      const currentPlan =
                        user.plan === 'supporters' || user.plan === 'cool'
                          ? user.plan
                          : 'free';

                      return (
                        <div
                          key={user.id}
                          className="admin-row-anim rounded-3xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <img
                                src={safeAvatarSource(user.avatarUrl)}
                                alt={user.displayName}
                                className="h-10 w-10 shrink-0 rounded-full border border-[var(--dc-border)] object-cover"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[var(--dc-text-strong)]">
                                  {user.displayName}
                                  {isSelf ? ' (You)' : ''}
                                </p>
                                <p className="truncate font-mono text-xs text-[var(--dc-text-muted)]">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                            <span className="shrink-0 rounded-full border border-[var(--dc-border)] bg-[var(--dc-panel)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--dc-text-strong)]">
                              {formatRoleLabel(user.role)}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--dc-border-subtle)] pt-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {canChangePlan && (
                                <>
                                  <PillDropdown
                                    value={currentPlan}
                                    onChange={v => {
                                      const nextPlan = v as 'free' | 'supporters' | 'cool';
                                      if (nextPlan !== user.plan) {
                                        setPendingAction({ kind: 'update_plan', user, nextPlan });
                                      }
                                    }}
                                    options={PLAN_OPTIONS}
                                    align="left"
                                    ariaLabel={`Change plan for ${user.email}`}
                                  />
                                  {(currentPlan === 'supporters' || currentPlan === 'cool') && (
                                    <button
                                      type="button"
                                      onClick={() => setSubTarget(user)}
                                      className="rounded-full border border-[var(--dc-border)] bg-[var(--dc-panel)] px-3 py-1.5 text-xs font-medium text-[var(--dc-text-muted)]"
                                    >
                                      Duration
                                    </button>
                                  )}
                                </>
                              )}

                              {user.isBanned && (
                                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-medium text-red-500">
                                  Banned
                                </span>
                              )}
                            </div>

                            {isManager && !isSelf && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPendingAction({
                                      kind: user.isBanned ? 'unban' : 'ban',
                                      user
                                    })
                                  }
                                  className="rounded-full border border-[var(--dc-border)] px-3 py-1 text-xs font-medium text-[var(--dc-text-strong)]"
                                >
                                  {user.isBanned ? 'Unban' : 'Ban'}
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Delete ${user.email}`}
                                  onClick={() => setPendingAction({ kind: 'delete', user })}
                                  className="rounded-full border border-red-500/30 px-3 py-1 text-xs font-medium text-red-500"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {(data?.auditLogs ?? []).length === 0 ? (
                <div className="rounded-3xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] py-12 text-center text-sm text-[var(--dc-text-muted)]">
                  No admin actions recorded yet.
                </div>
              ) : (
                data?.auditLogs.map(log => (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] px-4 py-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[var(--dc-border)] bg-[var(--dc-panel)] px-2.5 py-0.5 font-mono text-[11px] font-medium text-[var(--dc-text-strong)]">
                          {log.action}
                        </span>
                        <span className="text-xs text-[var(--dc-text-muted)]">
                          by <strong className="font-medium text-[var(--dc-text-strong)]">{log.actorEmail}</strong>
                        </span>
                        {log.targetEmail && (
                          <span className="text-xs text-[var(--dc-text-muted)]">
                            → <span className="font-mono text-[var(--dc-text)]">{log.targetEmail}</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[var(--dc-text-muted)]">
                        {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-[var(--dc-text)]">{log.reason}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      <AddUserModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreated={() => void invalidateOverview()}
      />

      <ActionReasonModal
        key={pendingAction ? `${pendingAction.kind}-${pendingAction.user.id}` : 'closed'}
        pending={pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirmAction}
      />

      <SubscriptionModal
        key={subTarget?.id ?? 'closed'}
        user={subTarget}
        onClose={() => setSubTarget(null)}
        onUpdated={() => void invalidateOverview()}
      />
    </div>
  );
}
