'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { Check, Eye, X } from '@/components/ui/icons';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import { buildDiffHunks, countDiffStats } from '@/lib/canvas/diff';
import type { CanvasPendingDiff } from '@/lib/canvas/types';

export function CanvasDiffView({
  diff,
  onAcceptAll,
  onRejectAll,
  onAcceptHunk,
  onRejectHunk,
  onOpenPreview,
}: {
  diff: CanvasPendingDiff;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onAcceptHunk: (hunkId: string) => void;
  onRejectHunk: (hunkId: string) => void;
  onOpenPreview: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hunks = useMemo(
    () => buildDiffHunks(diff.baseContent, diff.proposedContent, 3),
    [diff.baseContent, diff.proposedContent]
  );
  const stats = useMemo(
    () => countDiffStats(diff.baseContent, diff.proposedContent),
    [diff.baseContent, diff.proposedContent]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const blocks = el.querySelectorAll<HTMLElement>('[data-diff-hunk]');
      if (blocks.length > 0) {
        gsap.fromTo(
          blocks,
          { opacity: 0, y: 8 },
          {
            opacity: 1,
            y: 0,
            duration: 0.24,
            stagger: 0.03,
            ease: 'power2.out',
            clearProps: 'transform,opacity',
          }
        );
      }
    }, containerRef);
    return () => ctx.revert();
  }, [diff.path, hunks.length]);

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-col bg-[var(--dc-canvas)]">
      {/* Compact review summary header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--dc-border-subtle)] bg-[var(--dc-panel-muted)] px-4 py-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="truncate font-mono text-[12.5px] font-semibold text-[var(--dc-text-strong)]">
              {diff.path}
            </span>
            <span className="font-mono text-[11.5px] tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400">+{stats.added}</span>{' '}
              <span className="text-rose-600 dark:text-rose-400">-{stats.removed}</span>
            </span>
          </div>
          {diff.summary && (
            <p className="mt-0.5 truncate text-[12px] text-[var(--dc-text-muted)]">
              {diff.summary}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenPreview}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--dc-border)] bg-[var(--dc-surface)] px-2.5 text-[12px] font-medium text-[var(--dc-text)] transition-colors hover:bg-[var(--dc-surface-hover)]"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Preview</span>
        </button>
      </div>

      {/* Unified diff hunks */}
      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        {hunks.length === 0 ? (
          <div className="rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)] p-6 text-center text-[13px] text-[var(--dc-text-muted)]">
            No textual differences remaining.
          </div>
        ) : (
          hunks.map((hunk) => (
            <div
              key={hunk.id}
              data-diff-hunk
              className="overflow-hidden rounded-xl border border-[var(--dc-border)] bg-[var(--dc-surface)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--dc-border-subtle)] bg-[var(--dc-panel-muted)] px-3 py-1.5">
                <span className="font-mono text-[11px] text-[var(--dc-text-muted)]">
                  @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onRejectHunk(hunk.id)}
                    className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11.5px] font-medium text-rose-600 transition-colors hover:bg-rose-500/10 dark:text-rose-400"
                  >
                    <X className="h-3 w-3" />
                    <span>Reject</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onAcceptHunk(hunk.id)}
                    className="inline-flex h-7 items-center gap-1 rounded-md bg-emerald-600/12 px-2 text-[11.5px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-600/20 dark:bg-emerald-500/18 dark:text-emerald-300"
                  >
                    <Check className="h-3 w-3" />
                    <span>Accept</span>
                  </button>
                </div>
              </div>

              <div className="custom-scrollbar overflow-x-auto font-mono text-[12.5px] leading-[1.6]">
                <table className="w-full border-collapse">
                  <tbody>
                    {hunk.lines.map((line, lIdx) => {
                      const rowCls =
                        line.type === 'add'
                          ? 'dc-canvas-diff-add'
                          : line.type === 'remove'
                            ? 'dc-canvas-diff-del'
                            : 'text-[var(--dc-text-body)]';
                      const marker = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';

                      return (
                        <tr key={`${hunk.id}-${lIdx}`} className={rowCls}>
                          <td className="w-10 select-none border-r border-[var(--dc-border-subtle)] px-2 text-right text-[11px] text-[var(--dc-text-faint)] tabular-nums">
                            {line.oldLine ?? ''}
                          </td>
                          <td className="w-10 select-none border-r border-[var(--dc-border-subtle)] px-2 text-right text-[11px] text-[var(--dc-text-faint)] tabular-nums">
                            {line.newLine ?? ''}
                          </td>
                          <td className="w-5 select-none pl-2 text-center font-semibold opacity-80">
                            {marker}
                          </td>
                          <td className="whitespace-pre pr-3">{line.text || ' '}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom decision bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--dc-border)] bg-[var(--dc-panel)] px-4 py-2.5">
        <span className="text-[12px] font-medium text-[var(--dc-text-muted)]">
          {diff.action === 'delete'
            ? 'Confirm deleting this file from workspace'
            : `${hunks.length} ${hunks.length === 1 ? 'change block' : 'change blocks'} pending review`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRejectAll}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3 text-[12.5px] font-medium text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-surface-hover)] active:scale-[0.98]"
          >
            <X className="h-3.5 w-3.5 text-rose-500" />
            <span>Reject</span>
          </button>
          <button
            type="button"
            onClick={onAcceptAll}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--dc-invert)] px-3.5 text-[12.5px] font-medium text-[var(--dc-text-on-invert)] transition-colors hover:bg-[var(--dc-invert-hover)] active:scale-[0.98]"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{diff.action === 'delete' ? 'Confirm delete' : 'Accept changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
