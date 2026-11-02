'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeftToLine, ArrowRightToLine, Check, Code2, Copy, Download, Edit3, Maximize2, PanelBottom, Play, Trash2, X } from '@/components/ui/icons';
import type { Highlighter } from 'shiki';
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

const normalizeLanguage = (language: string) => normalizeCodeLanguage(language);
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
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors ${active ? 'bg-slate-100 text-slate-950' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'}`}
    >
      {children}
    </button>
  );
}

const CodeStreamingSpinner = React.memo(function CodeStreamingSpinner() {
  const animationDelay = '-0.35s';
  return <span className="deepchat-code-spinner" style={{ animationDelay }} aria-hidden="true" />;
});

function ModeSwitch({ mode, onShowCode, onRunPreview }: { mode: 'preview' | 'code', onShowCode: () => void, onRunPreview: () => void }) {
  const activeOffset = mode === 'code' ? 'translate-x-0' : 'translate-x-full';

  return (
    <div className="relative grid h-9 w-[76px] grid-cols-2 overflow-hidden rounded-full bg-slate-100 p-1 text-slate-600 ring-1 ring-slate-200">
      <span className={`absolute left-1 top-1 h-7 w-[34px] rounded-full bg-white shadow-sm transition-transform duration-300 ease-out ${activeOffset}`} />
      <button
        type="button"
        onClick={onShowCode}
        title="Show code"
        aria-label="Show code"
        className={`relative z-10 inline-flex items-center justify-center rounded-full transition-colors duration-300 ${mode === 'code' ? 'text-slate-950' : 'text-slate-500 hover:text-slate-800'}`}
      >
        <Code2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onRunPreview}
        title="Run preview"
        aria-label="Run preview"
        className={`relative z-10 inline-flex items-center justify-center rounded-full transition-colors duration-300 ${mode === 'preview' ? 'text-slate-950' : 'text-slate-500 hover:text-slate-800'}`}
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
        className={`code-preview-code modern-scrollbar overflow-auto bg-white p-4 text-sm text-slate-900 outline-none ring-0 selection:bg-indigo-200/70 [&>pre]:!m-0 [&>pre]:!bg-transparent [&>pre]:!p-0 [&_code]:!bg-transparent ${fill ? 'h-full' : 'min-h-[340px]'}`}
      />
    );
  }

  return (
    <div className={`code-preview-code modern-scrollbar overflow-auto bg-white text-sm ${fill ? 'h-full' : 'max-h-[420px]'}`}>
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} className="[&>pre]:!m-0 [&>pre]:!bg-transparent [&>pre]:!p-4 [&_code]:!bg-transparent" />
      ) : (
        <pre className="m-0 overflow-x-auto p-4 text-slate-900">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

function PreviewFrame({ srcDoc, compact = false }: { srcDoc: string, compact?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-[22px] bg-white shadow-sm ring-1 ring-slate-200 ${compact ? 'h-full min-h-[360px]' : 'min-h-[420px]'}`}>
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
    <div className="flex flex-col overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h3 className="text-sm font-bold text-slate-950">Console</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            title="Clear console"
            aria-label="Clear console"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-800 transition hover:bg-slate-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close console"
              aria-label="Close console"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-800 transition hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="modern-scrollbar max-h-56 overflow-auto px-5 py-4 font-mono text-sm leading-7 text-slate-500">
        {entries.length > 0 ? entries.map((entry) => (
          <div key={entry.id} className={`whitespace-pre-wrap ${entry.type === 'error' ? 'text-red-500' : entry.type === 'warn' ? 'text-amber-600' : 'text-slate-950'}`}>
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
    window.addEventListener('deepchat:general-settings-updated', syncTheme);
    mediaQuery.addEventListener('change', syncTheme);
    return () => {
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

  const highlightedCode = useMemo(() => {
    if (!highlighter) return '';
    const theme = isDarkTheme ? 'github-dark' : 'light-plus';
    const fallbackTheme = isDarkTheme ? 'github-dark' : 'github-light';
    try {
      return highlighter.codeToHtml(draftCode, { lang: language || 'text', theme });
    } catch {
      return highlighter.codeToHtml(draftCode, { lang: 'text', theme: fallbackTheme });
    }
  }, [draftCode, highlighter, isDarkTheme, language]);

  const srcDoc = useMemo(() => buildPreviewDocument(draftCode, language, previewId), [draftCode, language, previewId]);

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
    <div className="deepchat-fullscreen-shell fixed inset-0 z-[999999] bg-white" data-state={fullscreenClosing ? 'closing' : 'open'}>
      <div className="deepchat-fullscreen-toolbar flex h-12 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => closeFullscreen()}
            title="Close"
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-900 transition hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowFullscreenCode((current) => !current)}
            title={showFullscreenCode ? 'Hide code' : 'Show code'}
            aria-label={showFullscreenCode ? 'Hide code' : 'Show code'}
            className={`inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-bold ring-1 ring-slate-200 transition-all duration-300 ${showFullscreenCode ? 'bg-slate-200 text-slate-950' : 'bg-slate-100 text-slate-950 hover:bg-slate-200'}`}
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

      <div className={`deepchat-fullscreen-stage relative h-[calc(100vh-48px)] ${showFullscreenCode ? 'p-3 pt-0' : 'p-0'}`}>
        <div className={`deepchat-fullscreen-workspace flex h-full overflow-hidden p-0 transition-[gap] duration-300 ${showFullscreenCode ? 'gap-3 rounded-[24px] bg-white shadow-sm ring-1 ring-slate-200' : 'gap-0 rounded-none bg-transparent shadow-none ring-0'}`}>
          <div data-open={showFullscreenCode ? 'true' : 'false'} className={`deepchat-fullscreen-editor-pane min-h-0 shrink-0 overflow-hidden rounded-[22px] border border-slate-200 bg-white transition-[width,opacity,transform] duration-300 ease-out ${showFullscreenCode ? 'w-[38%] translate-x-0 opacity-100' : 'w-0 -translate-x-6 border-transparent opacity-0'}`}>
            <div className="h-full min-w-[320px] overflow-auto">
              <CodeSurface code={draftCode} html={highlightedCode} editing onChange={setDraftCode} fill />
            </div>
          </div>
          <div className="deepchat-fullscreen-viewer-pane min-h-0 min-w-0 flex-1 overflow-hidden rounded-[22px] bg-white">
            <div className="flex h-full min-h-0 flex-col gap-3">
              <div className="min-h-0 flex-1 overflow-hidden rounded-[22px]">
                <PreviewFrame key={`fullscreen-${runId}`} srcDoc={srcDoc} compact />
              </div>
              <div className={`deepchat-fullscreen-console shrink-0 overflow-hidden transition-[max-height,opacity,transform,margin] duration-300 ease-out ${consoleOpen ? 'max-h-56 translate-y-0 opacity-100' : 'max-h-0 translate-y-3 opacity-0 pointer-events-none'}`}>
                <ConsolePanel entries={consoleEntries} onClear={clearConsole} onClose={() => setConsoleOpen(false)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="not-prose mb-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-200">
            {isStreaming ? <CodeStreamingSpinner /> : <Code2 className="h-4 w-4" />}
          </span>
          <span className="truncate rounded-full bg-slate-100 px-3 py-1.5 font-sans text-xs font-black uppercase tracking-wide text-slate-900 ring-1 ring-slate-200">{displayLanguage}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
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

      <div className={mode === 'preview' && isPreviewable ? 'p-3 pt-0' : 'border-t border-slate-100'}>
        {mode === 'preview' && isPreviewable ? (
          <div className="relative">
            <PreviewFrame key={runId} srcDoc={srcDoc} />
            <button
              type="button"
              onClick={() => openFullscreen(false)}
              title="Fullscreen"
              aria-label="Fullscreen"
              className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-800 shadow-sm transition hover:bg-slate-100"
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
