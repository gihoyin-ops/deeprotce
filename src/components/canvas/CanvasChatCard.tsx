'use client';

import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import {
  ChevronRight,
  Code2,
  FileSpreadsheet,
  FileText,
  Presentation,
} from '@/components/ui/icons';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import type { CanvasFileKind, CanvasMessageEvent } from '@/lib/canvas/types';

function getKindIcon(kind: CanvasFileKind) {
  switch (kind) {
    case 'sheet':
      return <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
    case 'slides':
      return <Presentation className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
    case 'doc':
      return <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" />;
    case 'pdf':
      return <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />;
    default:
      return <Code2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
  }
}

export function CanvasChatCard({
  events,
  onOpenFile,
}: {
  events: CanvasMessageEvent[];
  onOpenFile: (path: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.28, ease: 'expo.out', clearProps: 'transform,opacity' }
      );
    }, wrapRef);
    return () => ctx.revert();
  }, []);

  if (!events || events.length === 0) return null;

  return (
    <div ref={wrapRef} className="mt-2.5 flex w-full max-w-[34rem] flex-col gap-1.5">
      {events.map((ev) => {
        const isStreaming = ev.status === 'streaming';
        const actionLabel = isStreaming
          ? 'Writing in Canvas...'
          : ev.action === 'create'
            ? 'Created'
            : ev.action === 'delete'
              ? 'Pending deletion'
              : 'Updated';

        return (
          <button
            key={ev.id}
            type="button"
            onClick={() => onOpenFile(ev.path)}
            className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] px-3.5 py-2.5 text-left transition-colors duration-150 hover:border-[var(--dc-border-strong)] hover:bg-[var(--dc-surface-hover)] active:scale-[0.99]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--dc-panel-muted)]">
                {getKindIcon(ev.kind)}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13.5px] font-semibold text-[var(--dc-text-strong)]">
                    {ev.path}
                  </span>
                  {isStreaming && (
                    <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                  )}
                </div>
                <p className="mt-0.5 truncate text-[12px] text-[var(--dc-text-muted)]">
                  {ev.summary ? ev.summary : actionLabel}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {!isStreaming && (ev.linesAdded || ev.linesRemoved) ? (
                <span className="font-mono text-[11.5px] tabular-nums">
                  {ev.linesAdded ? (
                    <span className="text-emerald-600 dark:text-emerald-400">+{ev.linesAdded}</span>
                  ) : null}
                  {ev.linesAdded && ev.linesRemoved ? ' ' : null}
                  {ev.linesRemoved ? (
                    <span className="text-rose-600 dark:text-rose-400">-{ev.linesRemoved}</span>
                  ) : null}
                </span>
              ) : null}
              <ChevronRight className="h-4 w-4 text-[var(--dc-text-faint)] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--dc-text-strong)]" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
