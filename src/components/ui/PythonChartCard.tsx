'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import { ArrowUp, Cpu, Maximize2, X } from '@/components/ui/icons';
import KineticDot from '@/components/ui/KineticDot';
import {
  normalizeChartKey,
  usePythonFilesRegistry,
  type PythonOutputChart
} from '@/lib/code/python-files-context';
import { requestAiPythonEdit } from '@/lib/code/python-runtime';

const isDocumentDark = () => {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement;
  return root.classList.contains('dark') || root.dataset.appearance === 'dark';
};

export function PythonStatusShimmer({ label }: { label: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const shimmerRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const reduce = prefersReducedMotion();
    if (reduce) return;
    const ctx = gsap.context(() => {
      if (shimmerRef.current) {
        gsap.fromTo(
          shimmerRef.current,
          { backgroundPosition: '130% 50%' },
          { backgroundPosition: '-130% 50%', duration: 1.75, ease: 'none', repeat: -1 }
        );
      }
      if (iconRef.current) {
        gsap.fromTo(
          iconRef.current,
          { opacity: 0.45, scale: 0.94 },
          { opacity: 0.95, scale: 1.06, duration: 1.05, ease: 'sine.inOut', repeat: -1, yoyo: true }
        );
      }
    }, rootRef);
    return () => ctx.revert();
  }, [label]);

  return (
    <div ref={rootRef} className="not-prose my-2 flex w-fit items-center gap-2 py-0.5">
      <span
        ref={iconRef}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-slate-500 dark:text-slate-400"
      >
        <Cpu className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <span
        ref={shimmerRef}
        className="bg-gradient-to-r from-slate-500 via-slate-900 to-slate-500 bg-[length:220%_100%] bg-clip-text text-[13.5px] font-medium tracking-[-0.01em] text-transparent dark:from-slate-400 dark:via-slate-100 dark:to-slate-400"
      >
        {label}
      </span>
    </div>
  );
}

function resolveChartByKey(
  charts: PythonOutputChart[],
  rawKey: string
): PythonOutputChart | null {
  if (charts.length === 0) return null;
  const key = normalizeChartKey(rawKey);
  if (key === 'default' || key === '0' || key === '1') {
    return charts[0] ?? null;
  }
  const numeric = Number.parseInt(key, 10);
  if (!Number.isNaN(numeric) && String(numeric) === key && numeric >= 1) {
    return charts[numeric - 1] ?? null;
  }
  return charts.find((item) => item.id.toLowerCase() === key) ?? charts[0] ?? null;
}

export default function PythonChartCard({
  chartKey = 'default'
}: {
  chartKey?: string;
}) {
  const previewId = useMemo(() => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }, []);

  const {
    outputCharts,
    isMessageStreaming,
    activeRunnersCount,
    runnerStatus,
    runnerError,
    updateRunnerCode
  } = usePythonFilesRegistry();

  const chart = useMemo(
    () => resolveChartByKey(outputCharts, chartKey),
    [outputCharts, chartKey]
  );

  const [isDarkTheme, setIsDarkTheme] = useState(isDocumentDark);
  const [frameHeight, setFrameHeight] = useState(360);
  const [fullscreen, setFullscreen] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const fullscreenShellRef = useRef<HTMLDivElement | null>(null);
  const inlineIframeRef = useRef<HTMLIFrameElement | null>(null);
  const fullscreenIframeRef = useRef<HTMLIFrameElement | null>(null);
  const inlineReadyRef = useRef(false);
  const fullscreenReadyRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const syncTheme = () => setIsDarkTheme(isDocumentDark());
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    syncTheme();
    window.addEventListener('deepchat:appearance-settings-updated', syncTheme);
    window.addEventListener('deepchat:general-settings-updated', syncTheme);
    mediaQuery.addEventListener('change', syncTheme);
    return () => {
      window.removeEventListener('deepchat:appearance-settings-updated', syncTheme);
      window.removeEventListener('deepchat:general-settings-updated', syncTheme);
      mediaQuery.removeEventListener('change', syncTheme);
    };
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [fullscreen]);

  useEffect(() => () => editAbortRef.current?.abort(), []);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || !chart || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 8, scale: 0.99 },
        { opacity: 1, y: 0, scale: 1, duration: 0.34, ease: 'power3.out', clearProps: 'transform' }
      );
    }, el);
    return () => ctx.revert();
  }, [chart]);

  useLayoutEffect(() => {
    const el = fullscreenShellRef.current;
    if (!fullscreen || !el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, scale: 0.985 },
        { opacity: 1, scale: 1, duration: 0.24, ease: 'power2.out', clearProps: 'transform' }
      );
    }, el);
    return () => ctx.revert();
  }, [fullscreen]);

  // Post chart payload when iframes report ready, and validate strict source + nonce
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== 'deepchat-python-sandbox') return;

      const isInlineSource = Boolean(
        inlineIframeRef.current?.contentWindow &&
        event.source === inlineIframeRef.current.contentWindow
      );
      const isFullscreenSource = Boolean(
        fullscreenIframeRef.current?.contentWindow &&
        event.source === fullscreenIframeRef.current.contentWindow
      );
      if (!isInlineSource && !isFullscreenSource) return;

      if (data.type === 'ready') {
        if (isInlineSource) inlineReadyRef.current = true;
        if (isFullscreenSource) fullscreenReadyRef.current = true;
        const targetWindow = isFullscreenSource
          ? fullscreenIframeRef.current?.contentWindow
          : inlineIframeRef.current?.contentWindow;
        if (!targetWindow || !chart) return;
        targetWindow.postMessage(
          {
            source: 'deepchat-python-host',
            type: 'render_single_chart',
            previewId,
            isDark: isDarkTheme,
            chart: { kind: chart.kind, data: chart.data }
          },
          '*'
        );
        return;
      }

      if (data.previewId !== previewId) return;

      if (data.type === 'resize' && typeof data.height === 'number' && isInlineSource) {
        setFrameHeight(Math.max(240, Math.min(640, Math.round(data.height))));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [chart, isDarkTheme, previewId]);

  // Push updated chart payload when chart data or theme changes on already-ready iframes
  useEffect(() => {
    if (!chart) return;
    const payload = {
      source: 'deepchat-python-host',
      type: 'render_single_chart',
      previewId,
      isDark: isDarkTheme,
      chart: { kind: chart.kind, data: chart.data }
    };
    if (inlineReadyRef.current && inlineIframeRef.current?.contentWindow) {
      inlineIframeRef.current.contentWindow.postMessage(payload, '*');
    }
    if (fullscreen && fullscreenReadyRef.current && fullscreenIframeRef.current?.contentWindow) {
      fullscreenIframeRef.current.contentWindow.postMessage(payload, '*');
    }
  }, [chart, fullscreen, isDarkTheme, previewId]);

  const handleSubmitAiEdit = async () => {
    const instruction = editPrompt.trim();
    if (!instruction || isUpdating || !chart) return;

    editAbortRef.current?.abort();
    const controller = new AbortController();
    editAbortRef.current = controller;

    setIsUpdating(true);
    setEditError(null);
    setEditPrompt('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const updatedCode = await requestAiPythonEdit(
        chart.sourceCode,
        instruction,
        controller.signal
      );
      if (updatedCode) {
        const dispatched = updateRunnerCode(chart.runnerId, updatedCode);
        if (!dispatched) {
          setEditError('Could not update chart.');
        }
      } else {
        setEditError('Could not update chart.');
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setEditError('Failed to update. Try again.');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  if (!chart) {
    if (isMessageStreaming || activeRunnersCount > 0) {
      return <PythonStatusShimmer label={runnerStatus || 'Running Python…'} />;
    }
    if (runnerError) {
      return (
        <div className="not-prose my-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-mono text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {runnerError}
        </div>
      );
    }
    return null;
  }

  const fullscreenContent = fullscreen ? (
    <div
      ref={fullscreenShellRef}
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#0d1117]"
    >
      <div className="flex h-13 shrink-0 items-center justify-between px-4 sm:px-6">
        <button
          type="button"
          onClick={() => {
            fullscreenReadyRef.current = false;
            setFullscreen(false);
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          title="Close fullscreen"
          aria-label="Close fullscreen"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          {activeRunnersCount > 0 && (
            <PythonStatusShimmer label={runnerStatus || 'Updating chart…'} />
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-3 py-1 sm:px-6">
        <iframe
          ref={fullscreenIframeRef}
          title="Interactive chart fullscreen"
          sandbox="allow-scripts"
          src="/python-sandbox"
          className="h-full w-full rounded-2xl border-0 bg-white dark:bg-[#0d1117]"
        />
      </div>

      <div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-5">
        <div className="mx-auto w-full max-w-2xl">
          {editError && (
            <p className="mb-1.5 text-center text-xs text-red-500">{editError}</p>
          )}
          <div className="flex items-end gap-2 rounded-2xl bg-slate-100/90 px-3.5 py-2 shadow-xs ring-1 ring-slate-200/70 dark:bg-slate-900/90 dark:ring-slate-800">
            <textarea
              ref={textareaRef}
              rows={1}
              value={editPrompt}
              disabled={isUpdating}
              onChange={(e) => {
                setEditPrompt(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 108)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmitAiEdit();
                }
              }}
              placeholder={isUpdating ? 'Updating…' : 'Edit your chart…'}
              style={{ outline: 'none' }}
              className="max-h-[108px] min-h-[24px] flex-1 resize-none bg-transparent py-1 text-[14px] leading-5 text-slate-900 placeholder:text-slate-400 outline-none disabled:opacity-60 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <button
              type="button"
              disabled={isUpdating || !editPrompt.trim()}
              onClick={() => void handleSubmitAiEdit()}
              aria-label="Send edit"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition-opacity hover:opacity-90 disabled:opacity-35 dark:bg-slate-100 dark:text-slate-900"
            >
              {isUpdating ? (
                <KineticDot mode="thinking" size="sm" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div
        ref={cardRef}
        className="group/pyvis not-prose relative my-3 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0d1117]"
      >
        <iframe
          ref={inlineIframeRef}
          title="Interactive chart"
          sandbox="allow-scripts"
          src="/python-sandbox"
          style={{ height: `${frameHeight}px` }}
          className="block w-full border-0 bg-white dark:bg-[#0d1117]"
        />
        <button
          type="button"
          onClick={() => {
            fullscreenReadyRef.current = false;
            setFullscreen(true);
          }}
          title="Expand"
          aria-label="Expand"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/90 text-slate-700 opacity-90 shadow-sm ring-1 ring-slate-200/80 backdrop-blur-sm transition hover:bg-slate-100 hover:opacity-100 sm:opacity-0 sm:group-hover/pyvis:opacity-100 dark:bg-slate-900/90 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {fullscreenContent && createPortal(fullscreenContent, document.body)}
    </>
  );
}
