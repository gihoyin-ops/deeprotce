'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { ArrowUp, Check, Copy, Download, Maximize2, Plus, X } from '@/components/ui/icons';
import KineticDot from '@/components/ui/KineticDot';
import { downloadImageAsPng } from '@/lib/images/client-webp';

interface MermaidDiagramBlockProps {
  code: string;
  isStreaming?: boolean;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

function encodeMermaidBase64(source: string): string {
  try {
    const bytes = new TextEncoder().encode(source);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

function stripMermaidFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:mermaid|mmd)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

async function requestAiDiagramEdit(
  currentMermaid: string,
  instruction: string,
  signal: AbortSignal
): Promise<string> {
  let connectionId: string | undefined;
  let modelId: string | undefined;
  try {
    const raw = localStorage.getItem('selectedModelObj');
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: string; connectionId?: string };
      connectionId = parsed.connectionId;
      modelId = parsed.id;
    }
  } catch {}

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    signal,
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content:
            'You are a Mermaid diagram editor. Return ONLY the updated valid Mermaid diagram syntax. Do not include markdown fences (```), explanations, or extra text.',
        },
        {
          role: 'user',
          content: `Current Mermaid diagram:\n${currentMermaid}\n\nEdit instruction: ${instruction}`,
        },
      ],
      connectionId,
      modelId,
      tools: [],
      manualSearch: false,
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error('Could not update diagram');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = json.choices?.[0]?.delta?.content;
        if (typeof delta === 'string') {
          content += delta;
        }
      } catch {}
    }
  }

  return stripMermaidFences(content);
}

export default function MermaidDiagramBlock({
  code,
  isStreaming = false,
}: MermaidDiagramBlockProps) {
  const [activeCode, setActiveCode] = useState(code);
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenClosing, setFullscreenClosing] = useState(false);

  // Fullscreen AI prompt & zoom/pan state
  const [prompt, setPrompt] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const imgRef = useRef<HTMLImageElement | null>(null);
  const fullscreenImgRef = useRef<HTMLImageElement | null>(null);
  const fullscreenShellRef = useRef<HTMLDivElement | null>(null);
  const promptDockRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  useEffect(() => {
    setActiveCode(code);
  }, [code]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const diagramUrl = useMemo(() => {
    if (isStreaming) return '';
    const encoded = encodeMermaidBase64(activeCode.trim());
    return encoded ? `https://mermaid.ink/svg/${encoded}?bgColor=!ffffff` : '';
  }, [activeCode, isStreaming]);

  useLayoutEffect(() => {
    if (!loaded || !imgRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      imgRef.current,
      { opacity: 0, scale: 0.985 },
      { opacity: 1, scale: 1, duration: 0.36, ease: 'expo.out', clearProps: 'transform', force3D: true }
    );
  }, [loaded, diagramUrl]);

  // GSAP fullscreen entrance + bottom prompt dock glide
  useLayoutEffect(() => {
    if (!fullscreen || fullscreenClosing || !fullscreenShellRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tl = gsap.timeline({ defaults: { force3D: true } });
    tl.fromTo(
      fullscreenShellRef.current,
      { opacity: 0, scale: 0.985 },
      { opacity: 1, scale: 1, duration: 0.34, ease: 'expo.out', clearProps: 'transform' }
    );
    if (promptDockRef.current) {
      tl.fromTo(
        promptDockRef.current,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'expo.out', clearProps: 'transform' },
        0.08
      );
    }
    return () => {
      tl.kill();
    };
  }, [fullscreen, fullscreenClosing]);

  // Subtle GSAP pulse on fullscreen diagram while AI updates it
  useLayoutEffect(() => {
    if (!fullscreen || !fullscreenImgRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = fullscreenImgRef.current;
    gsap.killTweensOf(el);
    if (isUpdating) {
      gsap.to(el, { opacity: 0.45, duration: 0.4, ease: 'sine.inOut', repeat: -1, yoyo: true });
    } else {
      gsap.to(el, { opacity: 1, duration: 0.3, ease: 'power2.out' });
    }
  }, [fullscreen, isUpdating]);

  // Keyboard shortcuts in fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inTextarea = target?.tagName === 'TEXTAREA';
      if (e.key === 'Escape') {
        closeFullscreen();
        return;
      }
      if (inTextarea) return;
      if (e.key === '+' || e.key === '=') {
        setZoom(z => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)));
      } else if (e.key === '-') {
        setZoom(z => {
          const next = Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2));
          if (next <= 1) setOffset({ x: 0, y: 0 });
          return next;
        });
      } else if (e.key === '0') {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const openFullscreen = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setEditError(null);
    setFullscreenClosing(false);
    setFullscreen(true);
  };

  const closeFullscreen = () => {
    if (fullscreenClosing) return;
    abortRef.current?.abort();
    setFullscreenClosing(true);
    const shellEl = fullscreenShellRef.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce && shellEl) {
      gsap.killTweensOf(shellEl);
      gsap.to(shellEl, {
        opacity: 0,
        scale: 0.985,
        duration: 0.24,
        ease: 'power2.inOut',
        force3D: true,
        onComplete: () => {
          setFullscreen(false);
          setFullscreenClosing(false);
        },
      });
      return;
    }
    setFullscreen(false);
    setFullscreenClosing(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    if (!diagramUrl) return;
    void downloadImageAsPng(diagramUrl, 'diagram');
  };

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom(prev => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(prev + delta).toFixed(2)));
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    setOffset({
      x: dragRef.current.originX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.originY + (e.clientY - dragRef.current.startY),
    });
  };

  const handlePointerUp = () => {
    dragRef.current.active = false;
  };

  const handleSubmitAiEdit = async () => {
    const instruction = prompt.trim();
    if (!instruction || isUpdating) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsUpdating(true);
    setEditError(null);
    setPrompt('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const updatedMermaid = await requestAiDiagramEdit(activeCode, instruction, controller.signal);
      if (updatedMermaid) {
        setHasError(false);
        setActiveCode(updatedMermaid);
      } else {
        setEditError('Could not update diagram.');
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setEditError('Failed to update diagram. Try again.');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="group/diagram not-prose relative mb-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-white">
      {/* Subtle floating top-right actions on hover */}
      {!isStreaming && (
        <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover/diagram:opacity-100 sm:group-focus-within/diagram:opacity-100">
          <button
            type="button"
            onClick={() => void handleCopy()}
            title={copied ? 'Copied' : 'Copy'}
            aria-label={copied ? 'Copied' : 'Copy'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white/90 text-slate-600 shadow-xs backdrop-blur-xs transition-colors hover:bg-slate-50 hover:text-slate-950"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {!hasError && loaded && (
            <>
              <button
                type="button"
                onClick={handleDownload}
                title="Download"
                aria-label="Download"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white/90 text-slate-600 shadow-xs backdrop-blur-xs transition-colors hover:bg-slate-50 hover:text-slate-950"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={openFullscreen}
                title="Expand"
                aria-label="Expand"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white/90 text-slate-600 shadow-xs backdrop-blur-xs transition-colors hover:bg-slate-50 hover:text-slate-950"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      )}

      {isStreaming ? (
        <div className="flex h-44 items-center justify-center bg-white">
          <span className="text-xs font-medium text-slate-400">Drawing diagram...</span>
        </div>
      ) : hasError || !diagramUrl ? (
        <pre className="modern-scrollbar m-0 max-h-[380px] overflow-auto bg-white p-4 font-mono text-[13px] leading-6 text-slate-800">
          <code>{activeCode}</code>
        </pre>
      ) : (
        <div className="relative flex min-h-[160px] items-center justify-center p-5">
          {!loaded && (
            <span className="absolute text-xs font-medium text-slate-400">
              Loading diagram...
            </span>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={diagramUrl}
            alt="Diagram"
            onLoad={() => {
              setHasError(false);
              setLoaded(true);
            }}
            onError={() => {
              setHasError(true);
              setLoaded(false);
            }}
            onClick={() => loaded && openFullscreen()}
            className={`max-h-[520px] max-w-full cursor-zoom-in object-contain transition-opacity duration-200 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      )}

      {/* Pure Minimalist Fullscreen Modal with AI Prompt Bar */}
      {(fullscreen || fullscreenClosing) &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={fullscreenShellRef}
            className="fixed inset-0 z-[999999] flex h-[100dvh] w-screen flex-col overflow-hidden bg-white dark:bg-[#0b0d11]"
          >
            {/* Pure Borderless Top Navbar */}
            <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
              <button
                type="button"
                onClick={closeFullscreen}
                title="Close"
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1 sm:gap-1.5">
                <div className="inline-flex h-9 items-center rounded-lg bg-slate-100/80 p-0.5 dark:bg-slate-800/80">
                  <button
                    type="button"
                    onClick={() =>
                      setZoom(z => {
                        const next = Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2));
                        if (next <= 1) setOffset({ x: 0, y: 0 });
                        return next;
                      })
                    }
                    title="Zoom out"
                    aria-label="Zoom out"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-700 transition-colors hover:bg-white dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M5 12h14" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={resetView}
                    title="Reset zoom"
                    className="inline-flex h-8 min-w-[44px] items-center justify-center px-1.5 text-xs font-semibold text-slate-700 tabular-nums hover:text-slate-950 dark:text-slate-200 dark:hover:text-white"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom(z => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)))}
                    title="Zoom in"
                    aria-label="Zoom in"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-700 transition-colors hover:bg-white dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  title={copied ? 'Copied' : 'Copy'}
                  aria-label={copied ? 'Copied' : 'Copy'}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  title="Download"
                  aria-label="Download"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Interactive Zoom & Pan Diagram Stage */}
            <div
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onDoubleClick={() => (zoom > 1.05 ? resetView() : setZoom(2))}
              style={{ touchAction: zoom > 1 ? 'none' : 'pan-y' }}
              className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-white px-3 py-2 sm:px-6"
            >
              {diagramUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  ref={fullscreenImgRef}
                  src={diagramUrl}
                  alt="Diagram fullscreen"
                  draggable={false}
                  style={{
                    transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
                    cursor: zoom > 1 ? 'grab' : 'zoom-in',
                  }}
                  className="h-full w-full select-none object-contain transition-transform duration-150 ease-out"
                />
              )}
            </div>

            {/* Pure Minimalist Bottom AI Prompt Bar (No divider lines) */}
            <div
              ref={promptDockRef}
              className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-5"
            >
              <div className="mx-auto w-full max-w-2xl">
                {editError && (
                  <p className="mb-1.5 text-center text-xs text-red-500">{editError}</p>
                )}
                <div className="flex items-end gap-2 rounded-2xl bg-slate-100/90 px-3.5 py-2 shadow-xs ring-1 ring-slate-200/70 dark:bg-slate-900/90 dark:ring-slate-800">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={prompt}
                    disabled={isUpdating}
                    onChange={e => {
                      setPrompt(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 108)}px`;
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSubmitAiEdit();
                      }
                    }}
                    placeholder={isUpdating ? 'Updating diagram...' : 'Edit your diagrams...'}
                    style={{ outline: 'none' }}
                    className="max-h-[108px] min-h-[24px] flex-1 resize-none bg-transparent py-1 text-[14px] leading-5 text-slate-900 placeholder:text-slate-400 outline-none disabled:opacity-60 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    disabled={isUpdating || !prompt.trim()}
                    onClick={() => void handleSubmitAiEdit()}
                    aria-label="Send diagram edit"
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
          </div>,
          document.body
        )}
    </div>
  );
}
