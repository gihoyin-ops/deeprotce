'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { bundledLanguages, type BundledLanguage, type Highlighter } from 'shiki';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  Check,
  Code2,
  Copy,
  Download,
  Edit3,
  Maximize2,
  Play,
  X
} from '@/components/ui/icons';
import PythonFileCard from '@/components/ui/PythonFileCard';
import {
  normalizeFileKey,
  usePythonFilesRegistry,
  usePythonWorkspaceFiles
} from '@/lib/code/python-files-context';
import {
  isSafeDownloadFilename,
  prepareWorkspaceFiles,
  PYTHON_EXECUTION_TIMEOUT_MS,
  shouldAutoRunPython,
  type PythonOutputFile
} from '@/lib/code/python-runtime';

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
  html,
  editing,
  onChange,
  fill = false
}: {
  code: string;
  html: string;
  editing: boolean;
  onChange: (nextCode: string) => void;
  fill?: boolean;
}) {
  if (editing) {
    return (
      <textarea
        value={code}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className={`code-preview-code modern-scrollbar w-full resize-none border-0 bg-white p-4 font-mono text-[13.5px] leading-6 text-slate-900 outline-none dark:bg-[#0d1117] dark:text-slate-100 ${
          fill ? 'h-full' : 'min-h-[300px]'
        }`}
      />
    );
  }

  return (
    <div
      className={`code-preview-code modern-scrollbar overflow-auto bg-white text-[13.5px] leading-6 dark:bg-[#0d1117] ${
        fill ? 'h-full' : 'max-h-[440px]'
      }`}
    >
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
  const { referencedFiles, registerOutputFiles, setRunnerActive } = usePythonFilesRegistry();
  const preparedFiles = useMemo(
    () => prepareWorkspaceFiles(workspaceFiles),
    [workspaceFiles]
  );

  const [codeState, setCodeState] = useState(() => ({ source: value, draft: value }));
  const draftCode = codeState.source === value ? codeState.draft : value;
  const setDraftCode = (draft: string) => setCodeState({ source: value, draft });

  const isToolMode = useMemo(
    () => shouldAutoRunPython(draftCode, preparedFiles.length > 0),
    [draftCode, preparedFiles.length]
  );

  const [mode, setMode] = useState<'preview' | 'code'>(() =>
    !isStreaming && shouldAutoRunPython(value, preparedFiles.length > 0) ? 'preview' : 'code'
  );
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showFullscreenCode, setShowFullscreenCode] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(isDocumentDark);
  const [runId, setRunId] = useState(() =>
    !isStreaming && shouldAutoRunPython(value, preparedFiles.length > 0) ? 1 : 0
  );
  const [frameHeight, setFrameHeight] = useState(320);
  const [result, setResult] = useState<PythonRunResult | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const visualCardRef = useRef<HTMLDivElement | null>(null);
  const fullscreenShellRef = useRef<HTMLDivElement | null>(null);
  const inlineIframeRef = useRef<HTMLIFrameElement | null>(null);
  const fullscreenIframeRef = useRef<HTMLIFrameElement | null>(null);
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
    return () => {
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  // GSAP entrance for visual surface
  useLayoutEffect(() => {
    const el = visualCardRef.current;
    if (!el || mode !== 'preview' || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 10, scale: 0.99 },
        { opacity: 1, y: 0, scale: 1, duration: 0.36, ease: 'power3.out', clearProps: 'transform' }
      );
    }, el);
    return () => ctx.revert();
  }, [mode, runId]);

  // GSAP entrance for fullscreen overlay
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

  // Syntax highlighting (only when code view is needed)
  useEffect(() => {
    if (!highlighter || (isToolMode && !fullscreen)) return;
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

    if (!isStreaming) {
      highlightNow();
    } else {
      const elapsed = Date.now() - lastHighlightAtRef.current;
      const delay = elapsed >= STREAM_HIGHLIGHT_THROTTLE_MS ? 0 : STREAM_HIGHLIGHT_THROTTLE_MS - elapsed;
      timerId = window.setTimeout(highlightNow, delay);
    }

    return () => {
      active = false;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [draftCode, fullscreen, highlighter, isDarkTheme, isStreaming, isToolMode]);

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
  }, [clearExecutionTimer, previewId, setRunnerActive]);

  const startExecutionTimer = useCallback(() => {
    clearExecutionTimer();
    setTimedOut(false);
    setRunnerActive(previewId, true);
    timeoutRef.current = window.setTimeout(() => {
      setTimedOut(true);
      setRunnerActive(previewId, false);
      setResult((prev) => prev ?? {
        charts: [],
        images: [],
        files: [],
        stdout: '',
        stderr: '',
        error: `Execution timed out after ${PYTHON_EXECUTION_TIMEOUT_MS / 1000}s.`
      });
    }, PYTHON_EXECUTION_TIMEOUT_MS);
  }, [clearExecutionTimer, previewId, setRunnerActive]);

  // Auto-run like a tool call when AI finishes streaming analytical/chart/file Python code
  useEffect(() => {
    if (isStreaming || autoRanRef.current) return;
    if (!shouldAutoRunPython(draftCode, preparedFiles.length > 0)) return;
    autoRanRef.current = true;
    const timer = window.setTimeout(() => {
      setMode('preview');
      setResult(null);
      setRunId((n) => n + 1);
      startExecutionTimer();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [draftCode, isStreaming, preparedFiles.length, startExecutionTimer]);

  // Listen to sandboxed iframe postMessage with strict source + nonce verification
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== 'deepchat-python-sandbox') return;

      const isInlineSource = Boolean(inlineIframeRef.current?.contentWindow && event.source === inlineIframeRef.current.contentWindow);
      const isFullscreenSource = Boolean(fullscreenIframeRef.current?.contentWindow && event.source === fullscreenIframeRef.current.contentWindow);
      if (!isInlineSource && !isFullscreenSource) return;

      if (data.type === 'ready') {
        const targetWindow = isFullscreenSource
          ? fullscreenIframeRef.current?.contentWindow
          : inlineIframeRef.current?.contentWindow;
        if (!targetWindow) return;

        if (isFullscreenSource && result) {
          targetWindow.postMessage({
            source: 'deepchat-python-host',
            type: 'render_cached',
            previewId,
            isDark: isDarkTheme,
            result
          }, '*');
        } else {
          setRunnerActive(previewId, true);
          targetWindow.postMessage({
            source: 'deepchat-python-host',
            type: 'execute',
            previewId,
            code: draftCode,
            files: preparedFiles,
            isDark: isDarkTheme
          }, '*');
        }
        return;
      }

      if (data.previewId !== previewId) return;

      if (data.type === 'resize' && typeof data.height === 'number' && isInlineSource) {
        setFrameHeight(Math.max(220, Math.min(640, Math.round(data.height))));
        return;
      }

      if (data.type === 'done') {
        clearExecutionTimer();
        setRunnerActive(previewId, false);
        const files: PythonOutputFile[] = Array.isArray(data.files) ? data.files : [];
        if (files.length > 0) {
          registerOutputFiles(files);
        }
        setResult({
          charts: Array.isArray(data.charts) ? data.charts : [],
          images: Array.isArray(data.images) ? data.images : [],
          files,
          stdout: typeof data.stdout === 'string' ? data.stdout : '',
          stderr: typeof data.stderr === 'string' ? data.stderr : '',
          error: typeof data.error === 'string' ? data.error : ''
        });
        return;
      }

      if (data.type === 'error') {
        clearExecutionTimer();
        setRunnerActive(previewId, false);
        setResult({
          charts: [],
          images: [],
          files: [],
          stdout: '',
          stderr: '',
          error: typeof data.error === 'string' ? data.error : 'Python execution failed.'
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [clearExecutionTimer, draftCode, isDarkTheme, preparedFiles, previewId, registerOutputFiles, result, setRunnerActive]);

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

  const handleEdit = () => {
    setShowFullscreenCode(true);
    setFullscreen(true);
  };

  // Unreferenced generated files (fallback if AI didn't place [[file:...]] in text)
  const unreferencedFiles = useMemo(() => {
    if (!result?.files?.length) return [];
    return result.files.filter(
      (f) => isSafeDownloadFilename(f.name) && !referencedFiles.has(normalizeFileKey(f.name))
    );
  }, [referencedFiles, result]);

  const hasVisualOrTextOutput = useMemo(() => {
    if (!result) return true; // Keep visible while running
    return Boolean(
      result.charts.length > 0 ||
      result.images.length > 0 ||
      result.stdout.trim() ||
      result.stderr.trim() ||
      result.error.trim()
    );
  }, [result]);

  const fullscreenContent = fullscreen ? (
    <div ref={fullscreenShellRef} className="fixed inset-0 z-50 bg-slate-50/95 backdrop-blur-md dark:bg-slate-950/95">
      <div className="flex h-12 items-center justify-between border-b border-slate-200/80 px-4 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title="Exit fullscreen"
            aria-label="Exit fullscreen"
          >
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowFullscreenCode((prev) => !prev)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            {showFullscreenCode ? <ArrowLeftToLine className="h-3.5 w-3.5" /> : <ArrowRightToLine className="h-3.5 w-3.5" />}
            <span>{showFullscreenCode ? 'Hide code' : 'Show code'}</span>
          </button>
          {showFullscreenCode && (
            <button
              type="button"
              onClick={runPreview}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <Play className="h-3 w-3 fill-current" />
              <span>Run</span>
            </button>
          )}
        </div>
        {showFullscreenCode && (
          <div className="flex items-center gap-1">
            <IconButton title={copied ? 'Copied' : 'Copy'} onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </IconButton>
            <IconButton title="Download script" onClick={handleDownloadSource}>
              <Download className="h-4 w-4" />
            </IconButton>
          </div>
        )}
      </div>

      <div className={`relative h-[calc(100vh-48px)] ${showFullscreenCode ? 'p-3 pt-2' : 'p-0'}`}>
        <div className={`flex h-full overflow-hidden ${showFullscreenCode ? 'gap-3 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200 dark:bg-[#0d1117] dark:ring-slate-800' : ''}`}>
          {showFullscreenCode && (
            <div className="h-full w-1/2 min-w-[280px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <CodeSurface code={draftCode} html={highlightedCode} editing onChange={setDraftCode} fill />
            </div>
          )}
          <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white dark:bg-[#0d1117]">
            <iframe
              ref={fullscreenIframeRef}
              key={`py-full-${runId}`}
              title="Python fullscreen preview"
              sandbox="allow-scripts"
              src="/api/python-sandbox"
              className="h-full w-full flex-1 border-0 bg-white dark:bg-[#0d1117]"
            />
          </div>
        </div>
      </div>
    </div>
  ) : null;

  // Clean Visual / Tool Mode: NO code header, NO tags, NO Code/Preview switch
  if (isToolMode && mode === 'preview') {
    // While streaming, keep quiet until script is complete
    if (isStreaming) {
      return (
        <div className="not-prose my-3 flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm dark:border-slate-800 dark:bg-[#0d1117] dark:text-slate-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400 dark:bg-slate-500" />
          <span>Preparing analysis…</span>
        </div>
      );
    }

    // If Python only created files that are already placed via [[file:...]] in text, hide empty runner box
    if (result && !hasVisualOrTextOutput && unreferencedFiles.length === 0) {
      return null;
    }

    return (
      <>
        <div ref={visualCardRef} className="not-prose my-3 space-y-2.5">
          {(hasVisualOrTextOutput || !result) && (
            <div className="group/pyvis relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0d1117]">
              {timedOut ? (
                <div className="px-4 py-3 font-mono text-xs text-red-700 dark:text-red-300">
                  Execution timed out after {PYTHON_EXECUTION_TIMEOUT_MS / 1000}s.
                </div>
              ) : (
                <iframe
                  ref={inlineIframeRef}
                  key={`py-inline-${runId}`}
                  title="Visual output"
                  sandbox="allow-scripts"
                  src="/api/python-sandbox"
                  style={{ height: `${frameHeight}px` }}
                  className="block w-full border-0 bg-white dark:bg-[#0d1117]"
                />
              )}
              <button
                type="button"
                onClick={() => {
                  setShowFullscreenCode(false);
                  setFullscreen(true);
                }}
                title="Expand"
                aria-label="Expand"
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/90 text-slate-700 opacity-90 shadow-sm ring-1 ring-slate-200/80 backdrop-blur-sm transition hover:bg-slate-100 hover:opacity-100 sm:opacity-0 sm:group-hover/pyvis:opacity-100 dark:bg-slate-900/90 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
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

  // Standard Code Mode (for normal Python code examples / tutorials)
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
          <IconButton title="Edit" onClick={handleEdit}>
            <Edit3 className="h-4 w-4" />
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
                src="/api/python-sandbox"
                style={{ height: `${frameHeight}px` }}
                className="w-full rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-[#0d1117]"
              />
            )}
            <button
              type="button"
              onClick={() => {
                setShowFullscreenCode(false);
                setFullscreen(true);
              }}
              title="Fullscreen"
              aria-label="Fullscreen"
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/95 text-slate-800 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-100 dark:bg-slate-900/95 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            {unreferencedFiles.map((file, idx) => (
              <PythonFileCard key={`${file.name}-${idx}`} filename={file.name} directFile={file} />
            ))}
          </div>
        ) : (
          <CodeSurface code={draftCode} html={highlightedCode} editing={false} onChange={setDraftCode} />
        )}
      </div>

      {fullscreenContent && createPortal(fullscreenContent, document.body)}
    </div>
  );
}
