'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { bundledLanguages, type BundledLanguage, type Highlighter } from 'shiki';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import {
  ArrowUp,
  Check,
  Code2,
  Copy,
  Download,
  Maximize2,
  Play,
  X
} from '@/components/ui/icons';
import KineticDot from '@/components/ui/KineticDot';
import { PythonStatusShimmer } from '@/components/ui/PythonChartCard';
import PythonFileCard from '@/components/ui/PythonFileCard';
import {
  normalizeFileKey,
  usePythonFilesRegistry,
  usePythonWorkspaceFiles,
  type PythonOutputChart
} from '@/lib/code/python-files-context';
import {
  isSafeDownloadFilename,
  prepareWorkspaceFiles,
  prepareWorkspaceFilesAsync,
  PYTHON_EXECUTION_TIMEOUT_MS,
  requestAiPythonEdit,
  shouldAutoRunPython,
  type PythonOutputFile
} from '@/lib/code/python-runtime';
import {
  computePythonCacheKey,
  getCachedPythonResult,
  getMemoryCachedPythonResult,
  saveCachedPythonResult
} from '@/lib/code/python-cache';

interface PythonPreviewProps {
  value: string;
  highlighter: Highlighter | null;
  isStreaming?: boolean;
}

interface PythonRunResult {
  charts: string[];
  images: string[];
  files: PythonOutputFile[];
  stdout: string;
  stderr: string;
  error: string;
}

const STREAM_HIGHLIGHT_THROTTLE_MS = 140;

const isDocumentDark = () => {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement;
  return root.classList.contains('dark') || root.dataset.appearance === 'dark';
};

function IconButton({
  title,
  onClick,
  children,
  active = false
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        active
          ? 'bg-slate-200/80 text-slate-950 dark:bg-slate-800 dark:text-slate-100'
          : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function ModeSwitch({
  mode,
  onShowCode,
  onRunPreview
}: {
  mode: 'preview' | 'code';
  onShowCode: () => void;
  onRunPreview: () => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full bg-slate-200/80 p-0.5 dark:bg-slate-800">
      <button
        type="button"
        onClick={onShowCode}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
          mode === 'code'
            ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-900 dark:text-slate-100'
            : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-slate-100'
        }`}
      >
        <Code2 className="h-3.5 w-3.5" />
        <span>Code</span>
      </button>
      <button
        type="button"
        onClick={onRunPreview}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
          mode === 'preview'
            ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-900 dark:text-slate-100'
            : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-slate-100'
        }`}
      >
        <Play className="h-3 w-3 fill-current" />
        <span>Run</span>
      </button>
    </div>
  );
}

function CodeSurface({
  code,
  html
}: {
  code: string;
  html: string;
}) {
  return (
    <div className="code-preview-code modern-scrollbar max-h-[440px] overflow-auto bg-white text-[13.5px] leading-6 dark:bg-[#0d1117]">
      {html ? (
        <div
          className="px-4 py-3.5 font-mono text-[13.5px] leading-6 [&>pre]:!m-0 [&>pre]:!bg-transparent [&>pre]:!p-0 [&_code]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="m-0 px-4 py-3.5 font-mono text-[13.5px] leading-6 text-slate-800 dark:text-slate-100">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

export default function PythonPreview({
  value,
  highlighter,
  isStreaming = false
}: PythonPreviewProps) {
  const previewId = useMemo(() => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }, []);

  const workspaceFiles = usePythonWorkspaceFiles();
  const {
    referencedFiles,
    referencedCharts,
    registerOutputFiles,
    registerOutputCharts,
    setRunnerActive,
    setRunnerStatus,
    setRunnerError,
    registerRunnerUpdater
  } = usePythonFilesRegistry();

  const preparedFiles = useMemo(
    () => prepareWorkspaceFiles(workspaceFiles),
    [workspaceFiles]
  );

  const [codeState, setCodeState] = useState(() => ({ source: value, draft: value }));
  const draftCode = codeState.source === value ? codeState.draft : value;
  const setDraftCode = useCallback(
    (draft: string) => setCodeState({ source: value, draft }),
    [value]
  );

  const isToolMode = useMemo(
    () => shouldAutoRunPython(draftCode, preparedFiles.length > 0),
    [draftCode, preparedFiles.length]
  );

  const hasPlacedCharts = referencedCharts.size > 0;
  const hasChartCall = /\b(plotly|matplotlib|pyplot|seaborn|plt\.show|fig\.show)\b/.test(draftCode);
  const isSilentFileMode = referencedFiles.size > 0 && !hasPlacedCharts && !hasChartCall;

  const cacheKey = useMemo(
    () => computePythonCacheKey(draftCode, workspaceFiles),
    [draftCode, workspaceFiles]
  );

  const [initialMemHit] = useState<PythonRunResult | null>(() =>
    !isStreaming ? getMemoryCachedPythonResult(computePythonCacheKey(value, workspaceFiles)) : null
  );

  const [mode, setMode] = useState<'preview' | 'code'>(() =>
    !isStreaming && shouldAutoRunPython(value, preparedFiles.length > 0) ? 'preview' : 'code'
  );
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(isDocumentDark);
  const [runId, setRunId] = useState(() =>
    !isStreaming && shouldAutoRunPython(value, preparedFiles.length > 0) ? 1 : 0
  );
  const [frameHeight, setFrameHeight] = useState(320);
  const [result, setResult] = useState<PythonRunResult | null>(() => initialMemHit);
  const [cacheChecked, setCacheChecked] = useState<boolean>(() =>
    Boolean(initialMemHit) || isStreaming || !shouldAutoRunPython(value, preparedFiles.length > 0)
  );
  const [statusLabel, setStatusLabel] = useState('Running Python…');
  const [timedOut, setTimedOut] = useState(false);

  const [editPrompt, setEditPrompt] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const visualCardRef = useRef<HTMLDivElement | null>(null);
  const fullscreenShellRef = useRef<HTMLDivElement | null>(null);
  const inlineIframeRef = useRef<HTMLIFrameElement | null>(null);
  const fullscreenIframeRef = useRef<HTMLIFrameElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editAbortRef = useRef<AbortController | null>(null);
  const autoRanRef = useRef(!isStreaming && shouldAutoRunPython(value, preparedFiles.length > 0));
  const timeoutRef = useRef<number | null>(null);

  const [highlightedState, setHighlightedState] = useState<{
    code: string;
    isDark: boolean;
    html: string;
  }>({ code: '', isDark: isDarkTheme, html: '' });
  const lastHighlightAtRef = useRef(0);

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
    const el = visualCardRef.current;
    if (!el || !result || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 8, scale: 0.99 },
        { opacity: 1, y: 0, scale: 1, duration: 0.34, ease: 'power3.out', clearProps: 'transform' }
      );
    }, el);
    return () => ctx.revert();
  }, [result]);

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

  useEffect(() => {
    if (!highlighter || isStreaming || isToolMode) return;
    let active = true;
    let timerId: number | null = null;

    const highlightNow = () => {
      const hasPython = Object.prototype.hasOwnProperty.call(bundledLanguages, 'python');
      const targetLang = (hasPython ? 'python' : 'text') as BundledLanguage;
      const run = async () => {
        try {
          if (targetLang !== ('text' as BundledLanguage) && !highlighter.getLoadedLanguages().includes(targetLang)) {
            await highlighter.loadLanguage(targetLang);
          }
          const html = highlighter.codeToHtml(draftCode, {
            lang: targetLang,
            theme: isDarkTheme ? 'github-dark' : 'github-light'
          });
          if (active) {
            lastHighlightAtRef.current = Date.now();
            setHighlightedState({ code: draftCode, isDark: isDarkTheme, html });
          }
        } catch {
          if (active) {
            setHighlightedState({ code: draftCode, isDark: isDarkTheme, html: '' });
          }
        }
      };
      void run();
    };

    const elapsed = Date.now() - lastHighlightAtRef.current;
    const delay = elapsed >= STREAM_HIGHLIGHT_THROTTLE_MS ? 0 : STREAM_HIGHLIGHT_THROTTLE_MS - elapsed;
    timerId = window.setTimeout(highlightNow, delay);

    return () => {
      active = false;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [draftCode, highlighter, isDarkTheme, isStreaming, isToolMode]);

  const highlightedCode =
    highlightedState.code === draftCode && highlightedState.isDark === isDarkTheme
      ? highlightedState.html
      : '';

  const clearExecutionTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearExecutionTimer();
    setRunnerActive(previewId, false);
    setRunnerStatus(previewId, '');
  }, [clearExecutionTimer, previewId, setRunnerActive, setRunnerStatus]);

  const startExecutionTimer = useCallback(() => {
    clearExecutionTimer();
    setTimedOut(false);
    setStatusLabel('Running Python…');
    setRunnerStatus(previewId, 'Running Python…');
    setRunnerError(previewId, '');
    setRunnerActive(previewId, true);
    timeoutRef.current = window.setTimeout(() => {
      const msg = `Execution timed out after ${PYTHON_EXECUTION_TIMEOUT_MS / 1000}s.`;
      setTimedOut(true);
      setRunnerActive(previewId, false);
      setRunnerStatus(previewId, '');
      setRunnerError(previewId, msg);
      setResult((prev) => prev ?? {
        charts: [],
        images: [],
        files: [],
        stdout: '',
        stderr: '',
        error: msg
      });
    }, PYTHON_EXECUTION_TIMEOUT_MS);
  }, [clearExecutionTimer, previewId, setRunnerActive, setRunnerError, setRunnerStatus]);

  // Register code updater so PythonChartCard fullscreen AI edit can re-run this runner live
  useEffect(() => {
    return registerRunnerUpdater(previewId, (nextCode: string) => {
      setDraftCode(nextCode);
      setResult(null);
      setMode('preview');
      setRunId((n) => n + 1);
      startExecutionTimer();
    });
  }, [previewId, registerRunnerUpdater, setDraftCode, startExecutionTimer]);

  const publishResultToContext = useCallback((next: PythonRunResult) => {
    if (next.files.length > 0) {
      registerOutputFiles(next.files);
    }
    const chartsPayload: PythonOutputChart[] = [
      ...next.charts.map((c, idx) => ({
        id: `plotly-${idx + 1}`,
        runnerId: previewId,
        kind: 'plotly' as const,
        data: c,
        sourceCode: draftCode
      })),
      ...next.images.map((img, idx) => ({
        id: `image-${idx + 1}`,
        runnerId: previewId,
        kind: 'image' as const,
        data: img,
        sourceCode: draftCode
      }))
    ];
    registerOutputCharts(previewId, chartsPayload);
    setRunnerError(previewId, next.error);
  }, [draftCode, previewId, registerOutputCharts, registerOutputFiles, setRunnerError]);

  // Hydrate context if memory cache already hit on initial mount
  useEffect(() => {
    if (!initialMemHit) return;
    publishResultToContext(initialMemHit);
  }, [initialMemHit, publishResultToContext]);

  // Auto-run like a tool call (with IndexedDB cache check first so refresh never re-runs Pyodide!)
  useEffect(() => {
    if (isStreaming || autoRanRef.current) return;
    if (!shouldAutoRunPython(draftCode, preparedFiles.length > 0)) return;
    autoRanRef.current = true;
    let active = true;

    void getCachedPythonResult(cacheKey).then((cached) => {
      if (!active) return;
      if (cached) {
        publishResultToContext(cached);
        setResult(cached);
        setMode('preview');
        setCacheChecked(true);
        setRunId((n) => n + 1);
      } else {
        setResult(null);
        setMode('preview');
        setCacheChecked(true);
        setRunId((n) => n + 1);
        startExecutionTimer();
      }
    });

    return () => {
      active = false;
    };
  }, [cacheKey, draftCode, isStreaming, preparedFiles.length, publishResultToContext, startExecutionTimer]);

  // If mounted already finished without memory hit, check IndexedDB cache before starting Pyodide
  useEffect(() => {
    if (isStreaming || cacheChecked || !isToolMode) return;
    let active = true;

    void getCachedPythonResult(cacheKey).then((cached) => {
      if (!active) return;
      if (cached) {
        publishResultToContext(cached);
        setResult(cached);
        setCacheChecked(true);
      } else {
        setCacheChecked(true);
        setRunId((n) => n + 1);
        startExecutionTimer();
      }
    });

    return () => {
      active = false;
    };
  }, [cacheChecked, cacheKey, isStreaming, isToolMode, publishResultToContext, startExecutionTimer]);

  // Listen to sandboxed iframe postMessage with strict source + nonce verification
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
        const targetWindow = isFullscreenSource
          ? fullscreenIframeRef.current?.contentWindow
          : inlineIframeRef.current?.contentWindow;
        if (!targetWindow) return;

        if (result) {
          targetWindow.postMessage({
            source: 'deepchat-python-host',
            type: 'render_cached',
            previewId,
            isDark: isDarkTheme,
            result
          }, '*');
        } else {
          setRunnerActive(previewId, true);
          void prepareWorkspaceFilesAsync(workspaceFiles).then((hydratedFiles) => {
            targetWindow.postMessage({
              source: 'deepchat-python-host',
              type: 'execute',
              previewId,
              code: draftCode,
              files: hydratedFiles,
              isDark: isDarkTheme
            }, '*');
          });
        }
        return;
      }

      if (data.previewId !== previewId) return;

      if (data.type === 'status' && typeof data.text === 'string') {
        setStatusLabel(data.text);
        setRunnerStatus(previewId, data.text);
        return;
      }

      if (data.type === 'resize' && typeof data.height === 'number' && isInlineSource) {
        setFrameHeight(Math.max(220, Math.min(640, Math.round(data.height))));
        return;
      }

      if (data.type === 'done') {
        clearExecutionTimer();
        setRunnerActive(previewId, false);
        setRunnerStatus(previewId, '');
        const files: PythonOutputFile[] = Array.isArray(data.files) ? data.files : [];
        const charts: string[] = Array.isArray(data.charts) ? data.charts : [];
        const images: string[] = Array.isArray(data.images) ? data.images : [];
        const errorStr = typeof data.error === 'string' ? data.error : '';

        if (files.length > 0) {
          registerOutputFiles(files);
        }

        const chartsPayload: PythonOutputChart[] = [
          ...charts.map((c, idx) => ({
            id: `plotly-${idx + 1}`,
            runnerId: previewId,
            kind: 'plotly' as const,
            data: c,
            sourceCode: draftCode
          })),
          ...images.map((img, idx) => ({
            id: `image-${idx + 1}`,
            runnerId: previewId,
            kind: 'image' as const,
            data: img,
            sourceCode: draftCode
          }))
        ];
        registerOutputCharts(previewId, chartsPayload);
        setRunnerError(previewId, errorStr);

        const nextResult: PythonRunResult = {
          charts,
          images,
          files,
          stdout: typeof data.stdout === 'string' ? data.stdout : '',
          stderr: typeof data.stderr === 'string' ? data.stderr : '',
          error: errorStr
        };
        setResult(nextResult);
        if (!errorStr) {
          void saveCachedPythonResult(cacheKey, nextResult);
        }
        return;
      }

      if (data.type === 'error') {
        clearExecutionTimer();
        const errMsg = typeof data.error === 'string' ? data.error : 'Python execution failed.';
        setRunnerActive(previewId, false);
        setRunnerStatus(previewId, '');
        setRunnerError(previewId, errMsg);
        registerOutputCharts(previewId, []);
        setResult({
          charts: [],
          images: [],
          files: [],
          stdout: '',
          stderr: '',
          error: errMsg
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [
    cacheKey,
    clearExecutionTimer,
    draftCode,
    isDarkTheme,
    preparedFiles,
    previewId,
    registerOutputCharts,
    registerOutputFiles,
    result,
    setRunnerActive,
    setRunnerError,
    setRunnerStatus,
    workspaceFiles
  ]);

  const runPreview = () => {
    setResult(null);
    setMode('preview');
    setRunId((n) => n + 1);
    startExecutionTimer();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draftCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleDownloadSource = () => {
    const blob = new Blob([draftCode], { type: 'text/x-python;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'script.py';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSubmitAiEdit = async () => {
    const instruction = editPrompt.trim();
    if (!instruction || isUpdating) return;

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
      const updatedCode = await requestAiPythonEdit(draftCode, instruction, controller.signal);
      if (updatedCode) {
        setDraftCode(updatedCode);
        setResult(null);
        setRunId((n) => n + 1);
        startExecutionTimer();
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

  const unreferencedFiles = useMemo(() => {
    if (!result?.files?.length) return [];
    return result.files.filter(
      (f) => isSafeDownloadFilename(f.name) && !referencedFiles.has(normalizeFileKey(f.name))
    );
  }, [referencedFiles, result]);

  const hasVisualOrTextOutput = useMemo(() => {
    if (!result) return true;
    return Boolean(
      result.charts.length > 0 ||
      result.images.length > 0 ||
      result.stdout.trim() ||
      result.stderr.trim() ||
      result.error.trim()
    );
  }, [result]);

  const fullscreenContent = fullscreen ? (
    <div
      ref={fullscreenShellRef}
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#0d1117]"
    >
      <div className="flex h-13 shrink-0 items-center justify-between px-4 sm:px-6">
        <button
          type="button"
          onClick={() => setFullscreen(false)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          title="Close fullscreen"
          aria-label="Close fullscreen"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          {!result && !timedOut && <PythonStatusShimmer label={statusLabel} />}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-3 py-1 sm:px-6">
        <iframe
          ref={fullscreenIframeRef}
          key={`py-full-${runId}`}
          title="Interactive visual fullscreen"
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
              placeholder={isUpdating ? 'Updating…' : 'Edit your chart or analysis…'}
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

  // 1. While streaming: if charts or files are explicitly placed via [[chart]] / [[file:...]], stay hidden here
  if (isStreaming) {
    if (hasPlacedCharts || isSilentFileMode) return null;
    return <PythonStatusShimmer label="Running Python…" />;
  }

  // 2. Visual / Tool Mode
  if (isToolMode && mode === 'preview') {
    // Silent runner mode when AI placed [[chart]] or [[file:...]] explicitly in prose
    if (hasPlacedCharts || isSilentFileMode) {
      return (
        <>
          {cacheChecked && !result && !timedOut && (
            <iframe
              ref={inlineIframeRef}
              key={`py-silent-${runId}`}
              title="Python background runner"
              sandbox="allow-scripts"
              src="/python-sandbox"
              aria-hidden="true"
              tabIndex={-1}
              className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px border-0 opacity-0"
            />
          )}
          {isSilentFileMode && result?.error && (
            <div className="not-prose my-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 font-mono text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              {result.error}
            </div>
          )}
          {unreferencedFiles.length > 0 && (
            <div className="not-prose my-3 space-y-2.5">
              {unreferencedFiles.map((file, idx) => (
                <PythonFileCard key={`${file.name}-${idx}`} filename={file.name} directFile={file} />
              ))}
            </div>
          )}
        </>
      );
    }

    if (result && !hasVisualOrTextOutput && unreferencedFiles.length === 0) {
      return null;
    }

    const isStillRunning = !result && !timedOut;

    return (
      <>
        <div className="not-prose my-3 space-y-2.5">
          {isStillRunning && <PythonStatusShimmer label={statusLabel} />}

          {(hasVisualOrTextOutput || !result) && (
            <div
              ref={visualCardRef}
              className={`group/pyvis relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0d1117] ${
                isStillRunning ? 'h-0 border-0 opacity-0 shadow-none' : ''
              }`}
            >
              {timedOut ? (
                <div className="px-4 py-3 font-mono text-xs text-red-700 dark:text-red-300">
                  Execution timed out after {PYTHON_EXECUTION_TIMEOUT_MS / 1000}s.
                </div>
              ) : cacheChecked ? (
                <iframe
                  ref={inlineIframeRef}
                  key={`py-inline-${runId}`}
                  title="Visual output"
                  sandbox="allow-scripts"
                  src="/python-sandbox"
                  style={{ height: isStillRunning ? '1px' : `${frameHeight}px` }}
                  className="block w-full border-0 bg-white dark:bg-[#0d1117]"
                />
              ) : null}
              {!isStillRunning && (
                <button
                  type="button"
                  onClick={() => setFullscreen(true)}
                  title="Expand"
                  aria-label="Expand"
                  className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/90 text-slate-700 opacity-90 shadow-sm ring-1 ring-slate-200/80 backdrop-blur-sm transition hover:bg-slate-100 hover:opacity-100 sm:opacity-0 sm:group-hover/pyvis:opacity-100 dark:bg-slate-900/90 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {unreferencedFiles.map((file, idx) => (
            <PythonFileCard key={`${file.name}-${idx}`} filename={file.name} directFile={file} />
          ))}
        </div>

        {fullscreenContent && createPortal(fullscreenContent, document.body)}
      </>
    );
  }

  // 3. Standard Code Mode (for pure Python code examples / tutorials)
  return (
    <div className="not-prose mb-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0d1117]">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 bg-slate-50/80 px-3.5 py-2.5 dark:border-slate-800/80 dark:bg-slate-900/70">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-7 items-center truncate rounded-lg bg-white px-2.5 font-mono text-[11px] font-semibold uppercase leading-none tracking-wider text-slate-700 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700/80">
            python
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <IconButton title={copied ? 'Copied' : 'Copy'} onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </IconButton>
          <ModeSwitch mode={mode} onShowCode={() => setMode('code')} onRunPreview={runPreview} />
          <IconButton title="Download script" onClick={handleDownloadSource}>
            <Download className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div className={mode === 'preview' ? 'p-3' : ''}>
        {mode === 'preview' ? (
          <div className="relative space-y-2.5">
            {timedOut ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-mono text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                Execution timed out after {PYTHON_EXECUTION_TIMEOUT_MS / 1000}s.
              </div>
            ) : (
              <iframe
                ref={inlineIframeRef}
                key={`py-inline-${runId}`}
                title="Python preview"
                sandbox="allow-scripts"
                src="/python-sandbox"
                style={{ height: `${frameHeight}px` }}
                className="w-full rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-[#0d1117]"
              />
            )}
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              title="Expand"
              aria-label="Expand"
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/95 text-slate-800 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-100 dark:bg-slate-900/95 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            {unreferencedFiles.map((file, idx) => (
              <PythonFileCard key={`${file.name}-${idx}`} filename={file.name} directFile={file} />
            ))}
          </div>
        ) : (
          <CodeSurface code={draftCode} html={highlightedCode} />
        )}
      </div>

      {fullscreenContent && createPortal(fullscreenContent, document.body)}
    </div>
  );
}
