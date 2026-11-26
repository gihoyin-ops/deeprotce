'use client';

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { Check, Code2, Copy, Maximize2, X } from '@/components/ui/icons';
import KineticDot from '@/components/ui/KineticDot';
import { buildMermaidDocument } from '@/lib/code/mermaid-preview';

interface MermaidDiagramBlockProps {
  code: string;
  isStreaming?: boolean;
}

function detectDiagramLabel(code: string): string {
  const firstLine = code
    .trim()
    .replace(/^%%\{[\s\S]*?\}%%\s*/, '')
    .split('\n')[0]
    ?.trim()
    .toLowerCase() || '';

  if (firstLine.startsWith('flowchart') || firstLine.startsWith('graph')) return 'Flowchart';
  if (firstLine.startsWith('sequencediagram')) return 'Sequence Diagram';
  if (firstLine.startsWith('classdiagram')) return 'Class Diagram';
  if (firstLine.startsWith('statediagram')) return 'State Diagram';
  if (firstLine.startsWith('erdiagram')) return 'ER Diagram';
  if (firstLine.startsWith('gantt')) return 'Gantt Chart';
  if (firstLine.startsWith('pie')) return 'Pie Chart';
  if (firstLine.startsWith('mindmap')) return 'Mindmap';
  if (firstLine.startsWith('timeline')) return 'Timeline';
  if (firstLine.startsWith('gitgraph')) return 'Git Graph';
  return 'Diagram';
}

export default function MermaidDiagramBlock({
  code,
  isStreaming = false,
}: MermaidDiagramBlockProps) {
  const previewId = useId().replace(/:/g, '');
  const [view, setView] = useState<'diagram' | 'code'>('diagram');
  const [copied, setCopied] = useState(false);
  const [frameHeight, setFrameHeight] = useState(280);
  const [fullscreen, setFullscreen] = useState(false);

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const fullscreenShellRef = useRef<HTMLDivElement | null>(null);
  const prevViewRef = useRef<'diagram' | 'code'>('diagram');

  const diagramLabel = useMemo(() => detectDiagramLabel(code), [code]);
  const srcDoc = useMemo(
    () => (isStreaming ? '' : buildMermaidDocument(code, '', '', previewId)),
    [code, isStreaming, previewId]
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { source?: string; previewId?: string; height?: number } | null;
      if (!data || data.source !== 'deepchat-mermaid-resize' || data.previewId !== previewId) return;
      if (typeof data.height === 'number' && Number.isFinite(data.height)) {
        setFrameHeight(Math.max(220, Math.min(680, Math.round(data.height))));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [previewId]);

  useLayoutEffect(() => {
    if (prevViewRef.current === view) return;
    prevViewRef.current = view;
    const el = bodyRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      el,
      { opacity: 0, y: 5 },
      { opacity: 1, y: 0, duration: 0.28, ease: 'expo.out', clearProps: 'transform,opacity', force3D: true }
    );
  }, [view]);

  useLayoutEffect(() => {
    if (!fullscreen) return;
    const el = fullscreenShellRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      el,
      { opacity: 0, scale: 0.985 },
      { opacity: 1, scale: 1, duration: 0.3, ease: 'expo.out', clearProps: 'transform', force3D: true }
    );
  }, [fullscreen]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="not-prose mb-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0d1117]">
      {/* Minimalist Dedicated Diagram Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3.5 py-2.5 dark:border-slate-800/80 dark:bg-slate-900/70">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-7 items-center gap-2 rounded-lg bg-white px-2.5 text-[11.5px] font-semibold tracking-tight text-slate-700 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700/80">
            <KineticDot mode={isStreaming ? 'thinking' : 'idle'} size="sm" />
            <span>{diagramLabel}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Diagram / Code segmented switch */}
          <div className="inline-flex h-7 items-center rounded-lg bg-slate-200/70 p-0.5 ring-1 ring-slate-200/90 dark:bg-slate-800 dark:ring-slate-700/80">
            <button
              type="button"
              onClick={() => setView('diagram')}
              className={`h-6 rounded-md px-2.5 text-[11px] font-semibold transition-colors ${
                view === 'diagram'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Diagram
            </button>
            <button
              type="button"
              onClick={() => setView('code')}
              className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-semibold transition-colors ${
                view === 'code'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Code2 className="h-3 w-3" />
              <span>Code</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handleCopy()}
            title={copied ? 'Copied' : 'Copy Mermaid source'}
            aria-label={copied ? 'Copied' : 'Copy Mermaid source'}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>

          {!isStreaming && (
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              title="Expand diagram"
              aria-label="Expand diagram"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div ref={bodyRef}>
        {view === 'code' ? (
          <pre className="modern-scrollbar m-0 max-h-[420px] overflow-auto bg-white p-4 font-mono text-[13px] leading-6 text-slate-800 dark:bg-[#0d1117] dark:text-slate-200">
            <code>{code}</code>
          </pre>
        ) : isStreaming ? (
          <div className="flex h-52 flex-col items-center justify-center gap-3 bg-slate-50/50 dark:bg-[#0d1117]">
            <KineticDot mode="thinking" size="lg" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Drawing {diagramLabel.toLowerCase()}...
            </span>
          </div>
        ) : (
          <iframe
            title={`${diagramLabel} preview`}
            srcDoc={srcDoc}
            sandbox="allow-scripts"
            style={{ height: `${frameHeight}px` }}
            className="block w-full border-0 bg-white transition-[height] duration-300 ease-out"
          />
        )}
      </div>

      {/* Fullscreen Diagram Modal */}
      {fullscreen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={fullscreenShellRef}
            className="fixed inset-0 z-[999999] flex flex-col bg-white dark:bg-[#0b0d11]"
          >
            <div className="flex h-12 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <KineticDot mode="idle" size="sm" />
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {diagramLabel}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreen(false)}
                  aria-label="Close diagram"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 p-3">
              <iframe
                title={`${diagramLabel} fullscreen preview`}
                srcDoc={srcDoc}
                sandbox="allow-scripts"
                className="h-full w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
