'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { ArrowLeftToLine, ArrowRightToLine, Check, Code2, Copy, Download, Edit3, Maximize2, PanelBottom, Play, Trash2, X } from '@/components/ui/icons';
import { bundledLanguages, type BundledLanguage, type Highlighter } from 'shiki';
import { buildPreviewDocument } from '@/lib/code/code-preview-builder';
import { normalizeCodeLanguage } from '@/lib/code/code-runner-detection';
import { isWebPreviewCode } from '@/lib/code/code-web-preview';

type ConsoleEntry = {
  id: number;
  type: string;
  text: string;
};

interface CodePreviewProps {
  language: string;
  value: string;
  highlighter: Highlighter | null;
  isStreaming?: boolean;
}

const FULLSCREEN_EXIT_MS = 320;
const STREAM_HIGHLIGHT_THROTTLE_MS = 140;

const normalizeLanguage = (language: string) => normalizeCodeLanguage(language);

const resolveShikiLanguage = (normalized: string): string => {
  const lower = normalized.trim().toLowerCase();
  if (!lower) return 'text';
  if (lower === 'svg') return 'xml';
  if (lower === 'c++') return 'cpp';
  return lower;
};
const isDocumentDark = () => {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement;
  return root.classList.contains('dark') || root.dataset.appearance === 'dark';
};

const getFileName = (language: string) => {
  const normalized = normalizeLanguage(language);
  if (normalized === 'svg') return 'preview.svg';
  if (normalized === 'html') return 'preview.html';
  const extensions: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    powershell: 'ps1',
    shell: 'sh',
    ruby: 'rb',
    rust: 'rs',
    cpp: 'cpp',
    'c++': 'cpp'
  };
  return `code.${extensions[normalized] || normalized || 'txt'}`;
};

const serializeConsoleValue = (value: unknown) => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

function IconButton({ title, onClick, children, active = false }: { title: string, onClick: () => void, children: React.ReactNode, active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${active ? 'bg-slate-200/80 text-slate-950 dark:bg-slate-800 dark:text-slate-100' : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'}`}
    >
      {children}
    </button>
  );
}

const CodeBadgeIndicator = React.memo(function CodeBadgeIndicator({ isStreaming }: { isStreaming: boolean }) {
  const badgeRef = useRef<HTMLSpanElement | null>(null);
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const loaderRef = useRef<HTMLSpanElement | null>(null);
  const arcRef = useRef<SVGSVGElement | null>(null);
  const hasMountedRef = useRef(false);

  useLayoutEffect(() => {
    const iconEl = iconRef.current;
    const loaderEl = loaderRef.current;
    const arcEl = arcRef.current;
    if (!iconEl || !loaderEl) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(iconEl, { opacity: isStreaming ? 0 : 1, scale: 1, rotation: 0 });
      gsap.set(loaderEl, { opacity: isStreaming ? 1 : 0, scale: 1 });
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        gsap.killTweensOf([iconEl, loaderEl, arcEl].filter(Boolean));

        if (!hasMountedRef.current) {
          hasMountedRef.current = true;
          if (isStreaming) {
            gsap.set(iconEl, { opacity: 0, scale: 0.6 });
            gsap.set(loaderEl, { opacity: 1, scale: 1 });
          } else {
            gsap.set(iconEl, { opacity: 1, scale: 1, rotation: 0 });
            gsap.set(loaderEl, { opacity: 0, scale: 0.6 });
          }
        } else if (isStreaming) {
          const tl = gsap.timeline({ defaults: { force3D: true } });
          tl.to(iconEl, {
            opacity: 0,
            scale: 0.55,
            rotation: -18,
            duration: 0.22,
            ease: 'power2.in',
          }).fromTo(
            loaderEl,
            { opacity: 0, scale: 0.6 },
            { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.6)' },
            0.08
          );
        } else {
          const tl = gsap.timeline({ defaults: { force3D: true } });
          tl.to(loaderEl, {
            opacity: 0,
            scale: 0.55,
            duration: 0.2,
            ease: 'power2.in',
          }).fromTo(
            iconEl,
            { opacity: 0, scale: 0.55, rotation: 16 },
            {
              opacity: 1,
              scale: 1,
              rotation: 0,
              duration: 0.36,
              ease: 'back.out(1.7)',
              clearProps: 'transform',
            },
            0.08
          );
        }

        if (isStreaming && arcEl) {
          gsap.to(arcEl, {
            rotation: 360,
            transformOrigin: '50% 50%',
            duration: 1,
            repeat: -1,
            ease: 'none',
            force3D: true,
          });
        }
      }, badgeRef);

      return () => ctx.revert();
    });

    return () => mm.revert();
  }, [isStreaming]);

  return (
    <span
      ref={badgeRef}
      className={`relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-300 ${
        isStreaming
          ? 'bg-blue-50/90 text-blue-600 ring-1 ring-blue-200/80 dark:bg-blue-500/15 dark:text-blue-400 dark:ring-blue-400/30'
          : 'bg-white text-slate-600 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700/80'
      }`}
    >
      <span ref={iconRef} className="absolute inset-0 flex items-center justify-center">
        <Code2 className="h-3.5 w-3.5" />
      </span>
      <span ref={loaderRef} className="absolute inset-0 flex items-center justify-center opacity-0">
        <svg
          ref={arcRef}
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="8.5"
            stroke="currentColor"
            strokeOpacity="0.22"
            strokeWidth="2.4"
          />
          <path
            d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {isStreaming && (
        <span className="sr-only" role="status" aria-live="polite">
          Generating code...
        </span>
      )}
    </span>
  );
});

function ModeSwitch({ mode, onShowCode, onRunPreview }: { mode: 'preview' | 'code', onShowCode: () => void, onRunPreview: () => void }) {
  const activeOffset = mode === 'code' ? 'translate-x-0' : 'translate-x-full';

  return (
    <div className="relative grid h-8 w-[72px] grid-cols-2 overflow-hidden rounded-lg bg-slate-200/70 p-0.5 text-slate-600 ring-1 ring-slate-200/90 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700/80">
      <span className={`absolute left-0.5 top-0.5 h-7 w-[34px] rounded-md bg-white shadow-xs transition-transform duration-300 ease-out dark:bg-slate-700 ${activeOffset}`} />
      <button
        type="button"
        onClick={onShowCode}
        title="Show code"
        aria-label="Show code"
        className={`relative z-10 inline-flex items-center justify-center rounded-md transition-colors duration-300 ${mode === 'code' ? 'text-slate-950 dark:text-slate-100' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
      >
        <Code2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onRunPreview}
        title="Run preview"
        aria-label="Run preview"
        className={`relative z-10 inline-flex items-center justify-center rounded-md transition-colors duration-300 ${mode === 'preview' ? 'text-slate-950 dark:text-slate-100' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
      >
        <Play className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CodeSurface({ code, html, editing, onChange, fill = false }: { code: string, html: string, editing: boolean, onChange: (value: string) => void, fill?: boolean }) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const editorHydratedRef = useRef(false);

  useEffect(() => {
    if (!editing) {
      editorHydratedRef.current = false;
      return;
    }
    if (!editorRef.current || editorHydratedRef.current) return;
    if (html) {
      editorRef.current.innerHTML = html;
    } else {
      editorRef.current.textContent = code;
    }
    editorHydratedRef.current = true;
  }, [code, editing, html]);

  const syncEditableCode = () => {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerText.replace(/\n$/, ''));
  };

  if (editing) {
    return (
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onInput={syncEditableCode}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          event.preventDefault();
          document.execCommand('insertText', false, '  ');
          syncEditableCode();
        }}
        style={{ outline: 'none' }}
        className={`code-preview-code modern-scrollbar overflow-auto bg-white p-4 text-[13.5px] leading-6 text-slate-900 outline-none focus:outline-none focus-visible:outline-none ring-0 selection:bg-indigo-200/70 dark:bg-[#0d1117] dark:text-slate-100 [&>pre]:!m-0 [&>pre]:!bg-transparent [&>pre]:!p-0 [&_code]:!bg-transparent ${fill ? 'h-full' : 'min-h-[340px]'}`}
      />
    );
  }

  return (
    <div className={`code-preview-code modern-scrollbar overflow-auto bg-white text-[13.5px] leading-6 dark:bg-[#0d1117] ${fill ? 'h-full' : 'max-h-[440px]'}`}>
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} className="[&>pre]:!m-0 [&>pre]:!bg-transparent [&>pre]:!p-4 [&_code]:!bg-transparent" />
      ) : (
        <pre className="m-0 overflow-x-auto p-4 text-slate-900 dark:text-slate-100">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

function PreviewFrame({ srcDoc, compact = false }: { srcDoc: string, compact?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 ${compact ? 'h-full min-h-[360px]' : 'min-h-[420px]'}`}>
      <iframe
        title="Code preview"
        srcDoc={srcDoc}
        sandbox="allow-forms allow-modals allow-popups allow-scripts"
        className="h-full min-h-[inherit] w-full border-0 bg-white"
      />
    </div>
  );
}

function ConsolePanel({ entries, onClear, onClose }: { entries: ConsoleEntry[], onClear: () => void, onClose?: () => void }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-950 dark:text-slate-100">Console</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            title="Clear console"
            aria-label="Clear console"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close console"
              aria-label="Close console"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="modern-scrollbar max-h-56 overflow-auto px-5 py-4 font-mono text-sm leading-7 text-slate-500 dark:text-slate-400">
        {entries.length > 0 ? entries.map((entry) => (
          <div key={entry.id} className={`whitespace-pre-wrap ${entry.type === 'error' ? 'text-red-500 dark:text-red-400' : entry.type === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-950 dark:text-slate-100'}`}>
            {entry.text}
          </div>
        )) : (
          <div>No logs</div>
        )}
      </div>
    </div>
  );
}

export default function CodePreview({ language, value, highlighter, isStreaming = false }: CodePreviewProps) {
  const previewId = useMemo(() => {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }, []);
  const normalizedLanguage = normalizeLanguage(language);
  const [codeState, setCodeState] = useState(() => ({ source: value, draft: value }));
  const [mode, setMode] = useState<'preview' | 'code'>('code');
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenClosing, setFullscreenClosing] = useState(false);
  const [showFullscreenCode, setShowFullscreenCode] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [runId, setRunId] = useState(0);
  const [isDarkTheme, setIsDarkTheme] = useState(isDocumentDark);
  const fullscreenCloseTimerRef = useRef<number | null>(null);
  const fullscreenShellRef = useRef<HTMLDivElement | null>(null);
  const fullscreenToolbarRef = useRef<HTMLDivElement | null>(null);
  const fullscreenStageRef = useRef<HTMLDivElement | null>(null);
  const editorPaneRef = useRef<HTMLDivElement | null>(null);
  const editorInnerRef = useRef<HTMLDivElement | null>(null);
  const consolePaneRef = useRef<HTMLDivElement | null>(null);
  const inlineBodyRef = useRef<HTMLDivElement | null>(null);
  const prevInlineModeRef = useRef<'preview' | 'code'>('code');
  const splitPaneMountedRef = useRef(false);
  const consoleMountedRef = useRef(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([
    { id: 1, type: 'system', text: 'Run started' }
  ]);

  const draftCode = codeState.source === value ? codeState.draft : value;
  const setDraftCode = (draft: string) => setCodeState({ source: value, draft });
  const isPreviewable = isWebPreviewCode(normalizedLanguage, draftCode);

  useEffect(() => {
    if (!fullscreen && !fullscreenClosing) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreen, fullscreenClosing]);

  useEffect(() => () => {
    if (fullscreenCloseTimerRef.current !== null) {
      window.clearTimeout(fullscreenCloseTimerRef.current);
    }
  }, []);

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
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== 'deepchat-code-preview-console') return;
      if (data.previewId !== previewId) return;
      const text = Array.isArray(data.args) ? data.args.map(serializeConsoleValue).join(' ') : '';
      setConsoleEntries((entries) => [...entries, { id: Date.now() + Math.random(), type: String(data.type || 'log'), text }]);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [previewId]);

  const shikiLanguage = resolveShikiLanguage(normalizedLanguage);
  const [loadedLangTick, setLoadedLangTick] = useState(0);
  const [throttledCode, setThrottledCode] = useState(draftCode);
  const lastHighlightTimeRef = useRef(0);

  useEffect(() => {
    if (!highlighter || shikiLanguage === 'text') return;
    if (highlighter.getLoadedLanguages().includes(shikiLanguage)) return;
    if (!(shikiLanguage in bundledLanguages)) return;

    let active = true;
    highlighter
      .loadLanguage(shikiLanguage as BundledLanguage)
      .then(() => {
        if (active) setLoadedLangTick((tick) => tick + 1);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [highlighter, shikiLanguage]);

  useEffect(() => {
    if (!isStreaming) {
      setThrottledCode(draftCode);
      lastHighlightTimeRef.current = Date.now();
      return;
    }

    const now = Date.now();
    const elapsed = now - lastHighlightTimeRef.current;
    if (elapsed >= STREAM_HIGHLIGHT_THROTTLE_MS) {
      lastHighlightTimeRef.current = now;
      setThrottledCode(draftCode);
      return;
    }

    const timer = window.setTimeout(() => {
      lastHighlightTimeRef.current = Date.now();
      setThrottledCode(draftCode);
    }, STREAM_HIGHLIGHT_THROTTLE_MS - elapsed);

    return () => window.clearTimeout(timer);
  }, [draftCode, isStreaming]);

  const codeToHighlight = isStreaming ? throttledCode : draftCode;

  const highlightedCode = useMemo(() => {
    if (!highlighter) return '';
    const theme = isDarkTheme ? 'github-dark' : 'github-light';
    const loadedLang = highlighter.getLoadedLanguages().includes(shikiLanguage) ? shikiLanguage : 'text';
    try {
      return highlighter.codeToHtml(codeToHighlight, { lang: loadedLang, theme });
    } catch {
      return highlighter.codeToHtml(codeToHighlight, { lang: 'text', theme });
    }
  }, [codeToHighlight, highlighter, isDarkTheme, loadedLangTick, shikiLanguage]);

  const needsPreviewDoc = (mode === 'preview' && isPreviewable) || fullscreen || fullscreenClosing;
  const srcDoc = useMemo(
    () => (needsPreviewDoc ? buildPreviewDocument(draftCode, language, previewId) : ''),
    [draftCode, language, needsPreviewDoc, previewId]
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draftCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([draftCode], { type: normalizedLanguage === 'svg' ? 'image/svg+xml' : 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = getFileName(language);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // GSAP inline fade/slide when flipping between code and preview
  useLayoutEffect(() => {
    if (prevInlineModeRef.current === mode) return;
    prevInlineModeRef.current = mode;
    const bodyEl = inlineBodyRef.current;
    if (!bodyEl) return;

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        bodyEl,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'expo.out', clearProps: 'transform,opacity', force3D: true }
      );
    });
    return () => mm.revert();
  }, [mode]);

  // GSAP entrance for the fullscreen portal
  useLayoutEffect(() => {
    if (!fullscreen || fullscreenClosing) return;
    const shellEl = fullscreenShellRef.current;
    const toolbarEl = fullscreenToolbarRef.current;
    const stageEl = fullscreenStageRef.current;
    if (!shellEl) return;

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { force3D: true } });
        tl.fromTo(shellEl, { opacity: 0 }, { opacity: 1, duration: 0.34, ease: 'power2.out' });
        if (toolbarEl) {
          tl.fromTo(
            toolbarEl,
            { opacity: 0, y: -10 },
            { opacity: 1, y: 0, duration: 0.44, ease: 'power3.out', clearProps: 'transform' },
            0.04
          );
        }
        if (stageEl) {
          tl.fromTo(
            stageEl,
            { opacity: 0, scale: 0.972, y: 10 },
            { opacity: 1, scale: 1, y: 0, duration: 0.52, ease: 'expo.out', clearProps: 'transform' },
            0.06
          );
        }
      }, shellEl);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, [fullscreen, fullscreenClosing]);

  // GSAP split-pane slide for toggling "Show code" / "Hide code"
  useLayoutEffect(() => {
    if (!fullscreen) {
      splitPaneMountedRef.current = false;
      return;
    }
    if (fullscreenClosing) return;

    const paneEl = editorPaneRef.current;
    const innerEl = editorInnerRef.current;
    if (!paneEl || !innerEl) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    const targetWidth = showFullscreenCode ? (isDesktop ? '38%' : '100%') : '0%';

    gsap.killTweensOf([paneEl, innerEl]);

    if (!splitPaneMountedRef.current || reduce) {
      splitPaneMountedRef.current = true;
      gsap.set(paneEl, {
        width: targetWidth,
        opacity: showFullscreenCode ? 1 : 0,
      });
      gsap.set(innerEl, {
        opacity: showFullscreenCode ? 1 : 0,
        x: 0,
      });
      return;
    }

    const tl = gsap.timeline({ defaults: { force3D: true } });

    if (showFullscreenCode) {
      tl.to(
        paneEl,
        {
          width: targetWidth,
          opacity: 1,
          duration: 0.42,
          ease: 'expo.out',
        },
        0
      ).fromTo(
        innerEl,
        { opacity: 0, x: -12 },
        { opacity: 1, x: 0, duration: 0.34, ease: 'power3.out', clearProps: 'transform' },
        0.04
      );
    } else {
      tl.to(
        innerEl,
        {
          opacity: 0,
          x: -8,
          duration: 0.2,
          ease: 'power2.out',
        },
        0
      ).to(
        paneEl,
        {
          width: '0%',
          opacity: 0,
          duration: 0.34,
          ease: 'power3.inOut',
        },
        0
      );
    }

    return () => {
      tl.kill();
    };
  }, [fullscreen, fullscreenClosing, showFullscreenCode]);

  // GSAP drawer animation for the console pane
  useLayoutEffect(() => {
    if (!fullscreen) {
      consoleMountedRef.current = false;
      return;
    }
    if (fullscreenClosing) return;

    const consoleEl = consolePaneRef.current;
    if (!consoleEl) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gsap.killTweensOf(consoleEl);

    if (!consoleMountedRef.current || reduce) {
      consoleMountedRef.current = true;
      gsap.set(consoleEl, {
        height: consoleOpen ? 'auto' : 0,
        opacity: consoleOpen ? 1 : 0,
        y: 0,
      });
      return;
    }

    if (consoleOpen) {
      gsap.fromTo(
        consoleEl,
        { height: 0, opacity: 0, y: 10 },
        {
          height: 'auto',
          opacity: 1,
          y: 0,
          duration: 0.38,
          ease: 'expo.out',
          clearProps: 'transform',
          force3D: true,
        }
      );
    } else {
      gsap.to(consoleEl, {
        height: 0,
        opacity: 0,
        y: 8,
        duration: 0.26,
        ease: 'power3.inOut',
        force3D: true,
      });
    }
  }, [fullscreen, fullscreenClosing, consoleOpen]);

  const openFullscreen = (withCode: boolean) => {
    if (fullscreenCloseTimerRef.current !== null) {
      window.clearTimeout(fullscreenCloseTimerRef.current);
      fullscreenCloseTimerRef.current = null;
    }
    setFullscreenClosing(false);
    setShowFullscreenCode(withCode);
    setFullscreen(true);
  };

  const closeFullscreen = () => {
    if (fullscreenClosing) return;
    setFullscreenClosing(true);

    const shellEl = fullscreenShellRef.current;
    const toolbarEl = fullscreenToolbarRef.current;
    const stageEl = fullscreenStageRef.current;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reduce && shellEl) {
      gsap.killTweensOf([shellEl, toolbarEl, stageEl].filter(Boolean));
      const tl = gsap.timeline({
        defaults: { force3D: true },
        onComplete: () => {
          setFullscreen(false);
          setFullscreenClosing(false);
        },
      });
      if (toolbarEl) {
        tl.to(toolbarEl, { opacity: 0, y: -8, duration: 0.26, ease: 'power3.inOut' }, 0);
      }
      if (stageEl) {
        tl.to(stageEl, { opacity: 0, scale: 0.976, y: 8, duration: 0.32, ease: 'power3.inOut' }, 0);
      }
      tl.to(shellEl, { opacity: 0, duration: 0.36, ease: 'power2.inOut' }, 0.04);
      return;
    }

    fullscreenCloseTimerRef.current = window.setTimeout(() => {
      setFullscreen(false);
      setFullscreenClosing(false);
      fullscreenCloseTimerRef.current = null;
    }, FULLSCREEN_EXIT_MS);
  };

  const handleEdit = () => {
    setMode('code');
    openFullscreen(true);
  };

  const runPreview = () => {
    setConsoleEntries([{ id: Date.now(), type: 'system', text: 'Run started' }]);
    setRunId((current) => current + 1);
    setMode('preview');
  };

  const displayLanguage = language || 'text';
  const clearConsole = () => setConsoleEntries([]);

  const fullscreenContent = (fullscreen || fullscreenClosing) ? (
    <div
      ref={fullscreenShellRef}
      className="deepchat-fullscreen-shell fixed inset-0 z-[999999] bg-white dark:bg-[#0b0d11]"
      data-state={fullscreenClosing ? 'closing' : 'open'}
    >
      <div ref={fullscreenToolbarRef} className="deepchat-fullscreen-toolbar flex h-12 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => closeFullscreen()}
            title="Close"
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-900 transition hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowFullscreenCode((current) => !current)}
            title={showFullscreenCode ? 'Hide code' : 'Show code'}
            aria-label={showFullscreenCode ? 'Hide code' : 'Show code'}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold ring-1 ring-slate-200 transition-all duration-300 dark:ring-slate-700 ${showFullscreenCode ? 'bg-slate-200 text-slate-950 dark:bg-slate-800 dark:text-slate-100' : 'bg-slate-100 text-slate-950 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'}`}
          >
            {showFullscreenCode ? <ArrowLeftToLine className="h-4 w-4" /> : <ArrowRightToLine className="h-4 w-4" />}
            {showFullscreenCode ? 'Hide code' : 'Show code'}
          </button>
        </div>
        <div className="flex items-center gap-1">
          <IconButton title="Toggle console" onClick={() => setConsoleOpen((current) => !current)} active={consoleOpen}>
            <PanelBottom className="h-4 w-4" />
          </IconButton>
          <IconButton title={copied ? 'Copied' : 'Copy'} onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </IconButton>
          <IconButton title="Download file" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div ref={fullscreenStageRef} className={`deepchat-fullscreen-stage relative h-[calc(100vh-48px)] ${showFullscreenCode ? 'p-3 pt-0' : 'p-0'}`}>
        <div className={`deepchat-fullscreen-workspace flex h-full overflow-hidden p-0 transition-[gap,border-radius] duration-300 ${showFullscreenCode ? 'gap-0 md:gap-3 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-[#0d1117] dark:ring-slate-800' : 'gap-0 rounded-none bg-transparent shadow-none ring-0'}`}>
          <div
            ref={editorPaneRef}
            data-open={showFullscreenCode ? 'true' : 'false'}
            className={`deepchat-fullscreen-editor-pane min-h-0 shrink-0 overflow-hidden rounded-xl bg-white dark:bg-[#0d1117] ${showFullscreenCode ? 'border border-slate-200 dark:border-slate-800' : 'border-0'}`}
          >
            <div ref={editorInnerRef} className="h-full min-w-0 md:min-w-[320px] overflow-auto">
              <CodeSurface code={draftCode} html={highlightedCode} editing onChange={setDraftCode} fill />
            </div>
          </div>
          <div className={`deepchat-fullscreen-viewer-pane min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl bg-white dark:bg-[#0d1117] ${showFullscreenCode ? 'hidden md:block' : 'block'}`}>
            <div className="flex h-full min-h-0 flex-col gap-3">
              <div className="min-h-0 flex-1 overflow-hidden rounded-xl">
                <PreviewFrame key={`fullscreen-${runId}`} srcDoc={srcDoc} compact />
              </div>
              <div
                ref={consolePaneRef}
                className={`deepchat-fullscreen-console shrink-0 overflow-hidden ${consoleOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
              >
                <ConsolePanel entries={consoleEntries} onClear={clearConsole} onClose={() => setConsoleOpen(false)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="not-prose mb-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0d1117]">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 bg-slate-50/80 px-3.5 py-2.5 dark:border-slate-800/80 dark:bg-slate-900/70">
        <div className="flex min-w-0 items-center gap-2">
          <CodeBadgeIndicator isStreaming={isStreaming} />
          <span className="inline-flex h-7 items-center truncate rounded-lg bg-white px-2.5 font-mono text-[11px] font-semibold uppercase leading-none tracking-wider text-slate-700 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700/80">
            {displayLanguage}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <IconButton title={copied ? 'Copied' : 'Copy'} onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          </IconButton>
          {isPreviewable && (
            <ModeSwitch mode={mode} onShowCode={() => setMode('code')} onRunPreview={runPreview} />
          )}
          <IconButton title="Download file" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </IconButton>
          <IconButton title="Edit" onClick={handleEdit}>
            <Edit3 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div ref={inlineBodyRef} className={mode === 'preview' && isPreviewable ? 'p-3' : ''}>
        {mode === 'preview' && isPreviewable ? (
          <div className="relative">
            <PreviewFrame key={runId} srcDoc={srcDoc} />
            <button
              type="button"
              onClick={() => openFullscreen(false)}
              title="Fullscreen"
              aria-label="Fullscreen"
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/95 text-slate-800 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-slate-100 dark:bg-slate-900/95 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <CodeSurface code={draftCode} html={highlightedCode} editing={false} onChange={setDraftCode} />
        )}
      </div>

      {fullscreenContent && createPortal(fullscreenContent, document.body)}
    </div>
  );
}
