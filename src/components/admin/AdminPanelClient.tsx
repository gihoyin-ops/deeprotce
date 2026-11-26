'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { gsap } from 'gsap';
import toast from 'react-hot-toast';
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
import { AddUserModal } from './AddUserModal';
import { ActionReasonModal, type PendingAdminAction } from './ActionReasonModal';
import { SubscriptionModal } from './SubscriptionModal';
import type { AdminOverviewResponse, AdminUserItem } from './types';

type AdminTab = 'users' | 'audit';

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

const roleBadgeClass = (role: AccountRole) => {
  if (role === 'manager_staff') {
    return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300';
  }
  if (role === 'staff') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
  }
  return 'border-[var(--dc-border)] bg-[var(--dc-surface)] text-[var(--dc-text-muted)]';
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
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.05, ease: 'power3.out' }
      );
      gsap.fromTo(
        '.admin-row-anim',
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.28, stagger: 0.025, ease: 'power2.out', delay: 0.1 }
      );
    }, rootRef);

    return () => ctx.revert();
  }, [data]);

  // Smooth tab transition
  useEffect(() => {
    if (!tabContentRef.current) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    gsap.fromTo(
      tabContentRef.current,
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }
    );
  }, [tab]);

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
        toast.success('Updated successfully');
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
      toast.success(`Revoked active sessions for ${user.email}`);
      await invalidateOverview();
    } catch {
      toast.error('Network error');
    }
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--dc-canvas)] p-6">
        <div className="w-full max-w-md rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-panel)] p-6 text-center">
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
            className="mt-5 rounded-xl bg-[var(--dc-invert)] px-4 py-2 text-sm font-medium text-[var(--dc-text-on-invert)]"
          >
            Back to Chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="min-h-screen bg-[var(--dc-canvas)] text-[var(--dc-text)]">
      {/* Top sticky header */}
      <header className="sticky top-0 z-30 border-b border-[var(--dc-border-subtle)] bg-[var(--dc-canvas)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => router.push('/')}
              aria-label="Back to chat"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-surface-hover)]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold tracking-tight text-[var(--dc-text-strong)] sm:text-lg">
                  Admin Panel
                </h1>
                {data?.actor && (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleBadgeClass(data.actor.role)}`}
                  >
                    {formatRoleLabel(data.actor.role)}
                  </span>
                )}
              </div>
              <p className="hidden truncate text-xs text-[var(--dc-text-muted)] sm:block">
                {isManager
                  ? 'Full operator control: manage users, staff, plans, bans, and audit logs.'
                  : 'Staff view: inspect accounts, audit logs, and adjust user plans.'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              aria-label="Refresh"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>

            {isManager && (
              <button
                type="button"
                onClick={() => setIsAddOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--dc-invert)] px-3.5 text-xs font-medium text-[var(--dc-text-on-invert)] transition-opacity hover:opacity-90 sm:text-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Add user</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {/* Stats strip */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {[
            { label: 'Total accounts', value: data?.stats.totalUsers ?? '—' },
            {
              label: 'Active staff',
              value: data?.stats.activeStaff ?? '—',
              sub: data ? `${data.stats.managerStaff} manager` : undefined
            },
            { label: 'Paid plans', value: data?.stats.paidUsers ?? '—' },
            { label: 'Suspended', value: data?.stats.bannedUsers ?? '—' }
          ].map(stat => (
            <div
              key={stat.label}
              className="admin-stat-card rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] p-4"
            >
              <p className="text-xs font-medium text-[var(--dc-text-muted)]">{stat.label}</p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight tabular-nums text-[var(--dc-text-strong)]">
                  {stat.value}
                </span>
                {stat.sub && (
                  <span className="text-[11px] text-[var(--dc-text-muted)]">{stat.sub}</span>
                )}
              </div>
            </div>
          ))}
        </section>

        {/* Tabs */}
        <div className="flex items-center justify-between gap-4 border-b border-[var(--dc-border-subtle)]">
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'users', label: `Users (${data?.users.length ?? 0})` },
                { id: 'audit', label: `Audit log (${data?.auditLogs.length ?? 0})` }
              ] as const
            ).map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`relative px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  tab === item.id
                    ? 'text-[var(--dc-text-strong)]'
                    : 'text-[var(--dc-text-muted)] hover:text-[var(--dc-text-strong)]'
                }`}
              >
                {item.label}
                {tab === item.id && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--dc-text-strong)]" />
                )}
              </button>
            ))}
          </div>
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
              {/* Filters */}
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 sm:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dc-text-muted)]" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search email, username, or name..."
                    className="h-9 w-full rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)] pl-9 pr-3 text-sm text-[var(--dc-text-strong)] outline-none focus:border-[var(--deepchat-accent)]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={roleFilter}
                    onChange={e => setRoleFilter(e.target.value as 'all' | AccountRole)}
                    aria-label="Filter by role"
                    className="h-9 rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3 text-xs font-medium text-[var(--dc-text-strong)] outline-none"
                  >
                    <option value="all">All roles</option>
                    <option value="user">User</option>
                    <option value="staff">Staff</option>
                    <option value="manager_staff">Manager Staff</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={e =>
                      setStatusFilter(e.target.value as 'all' | 'active' | 'banned')
                    }
                    aria-label="Filter by status"
                    className="h-9 rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3 text-xs font-medium text-[var(--dc-text-strong)] outline-none"
                  >
                    <option value="all">All status</option>
                    <option value="active">Active</option>
                    <option value="banned">Banned</option>
                  </select>
                </div>
              </div>

              {filteredUsers.length === 0 ? (
                <div className="rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] py-12 text-center text-sm text-[var(--dc-text-muted)]">
                  No accounts match your filter.
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden overflow-hidden rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] md:block">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--dc-border-subtle)] text-xs font-medium text-[var(--dc-text-muted)]">
                          <th className="px-4 py-3">Account</th>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3">Plan</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Joined</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--dc-border-subtle)]">
                        {filteredUsers.map(user => {
                          const isSelf = user.id === data?.actor.id;
                          const canChangePlan = isManager || user.role === 'user';
                          return (
                            <tr
                              key={user.id}
                              className="admin-row-anim transition-colors hover:bg-[var(--dc-surface-hover)]/50"
                            >
                              <td className="px-4 py-3">
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
                                        <span className="rounded bg-[var(--dc-fill)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--dc-text-muted)]">
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

                              <td className="px-4 py-3">
                                {isManager && !isSelf ? (
                                  <select
                                    value={user.role}
                                    aria-label={`Change role for ${user.email}`}
                                    onChange={e => {
                                      const nextRole = e.target.value as AccountRole;
                                      if (nextRole !== user.role) {
                                        setPendingAction({ kind: 'update_role', user, nextRole });
                                      }
                                    }}
                                    className={`rounded-full border px-2.5 py-1 text-xs font-medium outline-none ${roleBadgeClass(user.role)}`}
                                  >
                                    <option value="user">User</option>
                                    <option value="staff">Staff</option>
                                    <option value="manager_staff">Manager Staff</option>
                                  </select>
                                ) : (
                                  <span
                                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${roleBadgeClass(user.role)}`}
                                  >
                                    {formatRoleLabel(user.role)}
                                  </span>
                                )}
                              </td>

                              <td className="px-4 py-3">
                                {canChangePlan ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <select
                                        value={
                                          user.plan === 'supporters' || user.plan === 'cool'
                                            ? user.plan
                                            : 'free'
                                        }
                                        aria-label={`Change plan for ${user.email}`}
                                        onChange={e => {
                                          const nextPlan = e.target.value as
                                            | 'free'
                                            | 'supporters'
                                            | 'cool';
                                          if (nextPlan !== user.plan) {
                                            setPendingAction({ kind: 'update_plan', user, nextPlan });
                                          }
                                        }}
                                        className="rounded-lg border border-[var(--dc-border)] bg-[var(--dc-panel)] px-2 py-1 text-xs font-medium text-[var(--dc-text-strong)] outline-none"
                                      >
                                        <option value="free">Free</option>
                                        <option value="supporters">Supporters</option>
                                        <option value="cool">Cools</option>
                                      </select>
                                      {(user.plan === 'supporters' || user.plan === 'cool') && (
                                        <button
                                          type="button"
                                          onClick={() => setSubTarget(user)}
                                          className="rounded-lg border border-[var(--dc-border)] px-2 py-1 text-[11px] font-medium text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
                                        >
                                          Duration
                                        </button>
                                      )}
                                    </div>
                                    {(user.plan === 'supporters' || user.plan === 'cool') && (
                                      <p className="text-[11px] text-[var(--dc-text-muted)]">
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

                              <td className="px-4 py-3">
                                {user.isBanned ? (
                                  <div>
                                    <span className="inline-flex rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                                      Banned
                                    </span>
                                    {user.banReason && (
                                      <p
                                        title={user.banReason}
                                        className="mt-0.5 max-w-[160px] truncate text-[11px] text-[var(--dc-text-muted)]"
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

                              <td className="px-4 py-3 text-xs text-[var(--dc-text-muted)]">
                                {formatShortDate(user.createdAt)}
                              </td>

                              <td className="px-4 py-3 text-right">
                                {isManager && !isSelf ? (
                                  <div className="inline-flex items-center gap-1.5">
                                    {user.activeSessions > 0 && !user.isBanned && (
                                      <button
                                        type="button"
                                        onClick={() => void handleRevokeSessions(user)}
                                        className="rounded-lg border border-[var(--dc-border)] px-2 py-1 text-xs font-medium text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
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
                                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
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
                                      className="rounded-lg p-1.5 text-[var(--dc-text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-500"
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
                      return (
                        <div
                          key={user.id}
                          className="admin-row-anim rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] p-4"
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
                            <span
                              className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${roleBadgeClass(user.role)}`}
                            >
                              {formatRoleLabel(user.role)}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--dc-border-subtle)] pt-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {canChangePlan && (
                                <>
                                  <select
                                    value={
                                      user.plan === 'supporters' || user.plan === 'cool'
                                        ? user.plan
                                        : 'free'
                                    }
                                    onChange={e => {
                                      const nextPlan = e.target.value as
                                        | 'free'
                                        | 'supporters'
                                        | 'cool';
                                      if (nextPlan !== user.plan) {
                                        setPendingAction({ kind: 'update_plan', user, nextPlan });
                                      }
                                    }}
                                    className="rounded-lg border border-[var(--dc-border)] bg-[var(--dc-panel)] px-2 py-1 text-xs font-medium text-[var(--dc-text-strong)]"
                                  >
                                    <option value="free">Free</option>
                                    <option value="supporters">Supporters</option>
                                    <option value="cool">Cools</option>
                                  </select>
                                  {(user.plan === 'supporters' || user.plan === 'cool') && (
                                    <button
                                      type="button"
                                      onClick={() => setSubTarget(user)}
                                      className="rounded-lg border border-[var(--dc-border)] px-2 py-1 text-xs font-medium text-[var(--dc-text-muted)]"
                                    >
                                      Duration
                                    </button>
                                  )}
                                </>
                              )}

                              {user.isBanned ? (
                                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-500">
                                  Banned
                                </span>
                              ) : (
                                <span className="text-[11px] text-[var(--dc-text-muted)]">
                                  Active · {planLabel(user.plan)}
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
                                  className="rounded-lg border border-[var(--dc-border)] px-2.5 py-1 text-xs font-medium text-[var(--dc-text-strong)]"
                                >
                                  {user.isBanned ? 'Unban' : 'Ban'}
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Delete ${user.email}`}
                                  onClick={() => setPendingAction({ kind: 'delete', user })}
                                  className="rounded-lg border border-red-500/30 px-2 py-1 text-xs font-medium text-red-500"
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
            /* Audit log tab */
            <div className="space-y-2.5">
              {(data?.auditLogs ?? []).length === 0 ? (
                <div className="rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] py-12 text-center text-sm text-[var(--dc-text-muted)]">
                  No admin actions recorded yet.
                </div>
              ) : (
                data?.auditLogs.map(log => (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-[var(--dc-border-subtle)] bg-[var(--dc-surface)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-[var(--dc-border)] bg-[var(--dc-panel)] px-2 py-0.5 font-mono text-[11px] font-medium text-[var(--dc-text-strong)]">
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
