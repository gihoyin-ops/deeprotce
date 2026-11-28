'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { createHighlighter, createJavaScriptRegexEngine, type Highlighter } from 'shiki';
import {
  Monitor,
  PanelBottom,
  RefreshCw,
  Smartphone,
  Tablet,
  Trash2,
  X,
} from '@/components/ui/icons';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import { buildWorkspacePreviewDocument } from '@/lib/canvas/preview-bundler';
import { inferCodeLanguage, type CanvasFile, type CanvasMode } from '@/lib/canvas/types';

interface ConsoleEntry {
  id: number;
  type: string;
  text: string;
}

type FramePreset = 'desktop' | 'tablet' | 'mobile';

let canvasHighlighterPromise: Promise<Highlighter> | null = null;
function getCanvasHighlighter(): Promise<Highlighter> {
  if (!canvasHighlighterPromise) {
    canvasHighlighterPromise = createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: ['html', 'css', 'javascript', 'json', 'xml', 'markdown'],
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    }).catch((err) => {
      canvasHighlighterPromise = null;
      throw err;
    });
  }
  return canvasHighlighterPromise;
}

function isDarkDoc(): boolean {
  if (typeof document === 'undefined') return false;
  const root = document.documentElement;
  return root.classList.contains('dark') || root.dataset.appearance === 'dark';
}

function escapeHtml(raw: string): string {
  return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function CodeCanvasEditor({
  file,
  files,
  mode,
  isStreaming,
  onChange,
}: {
  file: CanvasFile;
  files: CanvasFile[];
  mode: Exclude<CanvasMode, 'diff'>;
  isStreaming: boolean;
  onChange: (nextContent: string) => void;
}) {
  const rawId = useId();
  const previewId = `canvas_${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const [isDark, setIsDark] = useState(isDarkDoc);
  const [framePreset, setFramePreset] = useState<FramePreset>('desktop');
  const [runId, setRunId] = useState(0);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [debouncedFiles, setDebouncedFiles] = useState(files);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preLayerRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void getCanvasHighlighter().then((hl) => {
      if (active) setHighlighter(hl);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const sync = () => setIsDark(isDarkDoc());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    window.addEventListener('deepchat:appearance-settings-updated', sync);
    window.addEventListener('deepchat:general-settings-updated', sync);
    mq.addEventListener('change', sync);
    return () => {
      window.removeEventListener('deepchat:appearance-settings-updated', sync);
      window.removeEventListener('deepchat:general-settings-updated', sync);
      mq.removeEventListener('change', sync);
    };
  }, []);

  // Debounce live preview rebuilds slightly while streaming or typing fast
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedFiles(files), isStreaming ? 180 : 120);
    return () => window.clearTimeout(timer);
  }, [files, isStreaming]);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as { source?: string; previewId?: string; type?: string; args?: unknown[] } | null;
      if (!data || data.source !== 'deepchat-canvas-preview-console' || data.previewId !== previewId) return;
      const text = Array.isArray(data.args) ? data.args.map(String).join(' ') : '';
      setConsoleEntries((prev) => [
        ...prev.slice(-120),
        { id: Date.now() + Math.random(), type: data.type || 'log', text },
      ]);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [previewId]);

  useEffect(() => {
    const el = consoleRef.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      gsap.set(el, { height: consoleOpen ? 160 : 0, opacity: consoleOpen ? 1 : 0 });
      return;
    }
    gsap.to(el, {
      height: consoleOpen ? 160 : 0,
      opacity: consoleOpen ? 1 : 0,
      duration: consoleOpen ? 0.28 : 0.2,
      ease: consoleOpen ? 'expo.out' : 'power2.inOut',
      overwrite: 'auto',
    });
  }, [consoleOpen]);

  const lang = inferCodeLanguage(file.path);
  const shikiLang = lang === 'svg' ? 'xml' : lang;
  const lineCount = useMemo(() => Math.max(1, file.content.split('\n').length), [file.content]);

  const highlightedHtml = useMemo(() => {
    if (!highlighter) return '';
    const theme = isDark ? 'github-dark' : 'github-light';
    const loaded = highlighter.getLoadedLanguages().includes(shikiLang) ? shikiLang : 'text';
    try {
      // Append trailing space when content ends with newline so overlay matches textarea height
      const normalized = file.content.endsWith('\n') ? `${file.content} ` : file.content;
      return highlighter.codeToHtml(normalized, { lang: loaded, theme });
    } catch {
      return `<pre><code>${escapeHtml(file.content)}</code></pre>`;
    }
  }, [file.content, highlighter, isDark, shikiLang]);

  const srcDoc = useMemo(
    () => (mode === 'preview' ? buildWorkspacePreviewDocument(debouncedFiles, file.path, previewId) : ''),
    [debouncedFiles, file.path, mode, previewId]
  );

  const syncScroll = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (preLayerRef.current) {
      preLayerRef.current.scrollTop = ta.scrollTop;
      preLayerRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = `${file.content.slice(0, start)}  ${file.content.slice(end)}`;
    onChange(next);
    window.requestAnimationFrame(() => {
      ta.selectionStart = start + 2;
      ta.selectionEnd = start + 2;
    });
  };

  if (mode === 'preview') {
    const frameWidth =
      framePreset === 'mobile' ? '390px' : framePreset === 'tablet' ? '768px' : '100%';

    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--dc-panel-muted)]">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--dc-border-subtle)] bg-[var(--dc-panel)] px-3 py-1.5">
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'desktop', icon: Monitor, label: 'Desktop width' },
                { id: 'tablet', icon: Tablet, label: 'Tablet width' },
                { id: 'mobile', icon: Smartphone, label: 'Mobile width' },
              ] as const
            ).map((preset) => {
              const IconComp = preset.icon;
              const active = framePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setFramePreset(preset.id)}
                  title={preset.label}
                  aria-label={preset.label}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                    active
                      ? 'bg-[var(--dc-surface-hover)] text-[var(--dc-text-strong)]'
                      : 'text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]'
                  }`}
                >
                  <IconComp className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setConsoleEntries([]);
                setRunId((n) => n + 1);
              }}
              title="Reload preview"
              aria-label="Reload preview"
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reload</span>
            </button>
            <button
              type="button"
              onClick={() => setConsoleOpen((o) => !o)}
              title="Toggle console"
              aria-label="Toggle console"
              className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium transition-colors ${
                consoleOpen
                  ? 'bg-[var(--dc-surface-hover)] text-[var(--dc-text-strong)]'
                  : 'text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]'
              }`}
            >
              <PanelBottom className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Console</span>
              {consoleEntries.length > 0 && (
                <span className="ml-0.5 text-[11px] tabular-nums text-[var(--dc-text-faint)]">
                  ({consoleEntries.length})
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-stretch justify-center overflow-auto p-2 sm:p-3">
          <div
            style={{ width: frameWidth, maxWidth: '100%' }}
            className="h-full min-h-[320px] overflow-hidden rounded-xl border border-[var(--dc-border)] bg-white shadow-xs transition-[width] duration-300"
          >
            <iframe
              key={`${file.path}-${runId}`}
              title={`Preview ${file.path}`}
              srcDoc={srcDoc}
              sandbox="allow-forms allow-modals allow-popups allow-scripts"
              className="h-full w-full border-0 bg-white"
            />
          </div>
        </div>

        <div
          ref={consoleRef}
          className="shrink-0 overflow-hidden border-t border-[var(--dc-border-subtle)] bg-[var(--dc-panel)]"
          style={{ height: 0, opacity: 0 }}
        >
          <div className="flex h-8 items-center justify-between border-b border-[var(--dc-border-subtle)] px-3">
            <span className="text-[11.5px] font-semibold text-[var(--dc-text-muted)]">Console</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setConsoleEntries([])}
                title="Clear console"
                aria-label="Clear console"
                className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)]"
              >
                <Trash2 className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setConsoleOpen(false)}
                title="Close console"
                aria-label="Close console"
                className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)]"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="custom-scrollbar h-[128px] overflow-y-auto px-3 py-2 font-mono text-[12px] leading-relaxed">
            {consoleEntries.length === 0 ? (
              <p className="text-[var(--dc-text-faint)]">No console output yet</p>
            ) : (
              consoleEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`whitespace-pre-wrap ${
                    entry.type === 'error'
                      ? 'text-rose-500'
                      : entry.type === 'warn'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-[var(--dc-text)]'
                  }`}
                >
                  {entry.text}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 bg-[var(--dc-canvas)] font-mono text-[13px] leading-[1.6]">
      {/* Line numbers gutter */}
      <div
        ref={gutterRef}
        aria-hidden="true"
        className="w-11 shrink-0 select-none overflow-hidden border-r border-[var(--dc-border-subtle)] bg-[var(--dc-panel-muted)] py-3 pr-2.5 text-right text-[11.5px] leading-[1.6] text-[var(--dc-text-faint)] tabular-nums"
      >
        {Array.from({ length: lineCount }, (_, idx) => (
          <div key={idx}>{idx + 1}</div>
        ))}
      </div>

      {/* Highlighted layer + transparent caret textarea */}
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div
          ref={preLayerRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden p-3 [&_code]:!bg-transparent [&_code]:!font-mono [&_code]:!text-[13px] [&_code]:!leading-[1.6] [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0"
          dangerouslySetInnerHTML={{
            __html: highlightedHtml || `<pre><code>${escapeHtml(file.content)}</code></pre>`,
          }}
        />
        <textarea
          ref={textareaRef}
          value={file.content}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label={`Edit ${file.path}`}
          className="custom-scrollbar relative z-10 h-full w-full resize-none bg-transparent p-3 font-mono text-[13px] leading-[1.6] text-transparent caret-[var(--dc-text-strong)] outline-none selection:bg-indigo-500/25"
        />
      </div>
    </div>
  );
}
