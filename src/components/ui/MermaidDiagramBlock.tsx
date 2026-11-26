'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { Check, Copy, Download, Maximize2, PenLine, Plus, X } from '@/components/ui/icons';
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

export default function MermaidDiagramBlock({
  code,
  isStreaming = false,
}: MermaidDiagramBlockProps) {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenClosing, setFullscreenClosing] = useState(false);

  // Fullscreen editor & zoom/pan state
  const [draftCode, setDraftCode] = useState(code);
  const [debouncedCode, setDebouncedCode] = useState(code);
  const [isEditing, setIsEditing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const imgRef = useRef<HTMLImageElement | null>(null);
  const fullscreenShellRef = useRef<HTMLDivElement | null>(null);
  const editorDrawerRef = useRef<HTMLDivElement | null>(null);
  const editorMountedRef = useRef(false);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  // Sync incoming code when not actively editing
  useEffect(() => {
    setDraftCode(code);
    setDebouncedCode(code);
  }, [code]);

  // Debounce live edits in fullscreen textarea
  useEffect(() => {
    if (!fullscreen) return;
    const timer = window.setTimeout(() => {
      setDebouncedCode(draftCode);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [draftCode, fullscreen]);

  const inlineUrl = useMemo(() => {
    if (isStreaming) return '';
    const encoded = encodeMermaidBase64(code.trim());
    return encoded ? `https://mermaid.ink/svg/${encoded}?bgColor=!ffffff` : '';
  }, [code, isStreaming]);

  const fullscreenUrl = useMemo(() => {
    const encoded = encodeMermaidBase64(debouncedCode.trim());
    return encoded ? `https://mermaid.ink/svg/${encoded}?bgColor=!ffffff` : '';
  }, [debouncedCode]);

  useLayoutEffect(() => {
    if (!loaded || !imgRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      imgRef.current,
      { opacity: 0, scale: 0.985 },
      { opacity: 1, scale: 1, duration: 0.36, ease: 'expo.out', clearProps: 'transform', force3D: true }
    );
  }, [loaded]);

  // GSAP fullscreen entrance
  useLayoutEffect(() => {
    if (!fullscreen || fullscreenClosing || !fullscreenShellRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      fullscreenShellRef.current,
      { opacity: 0, scale: 0.985 },
      { opacity: 1, scale: 1, duration: 0.32, ease: 'expo.out', clearProps: 'transform', force3D: true }
    );
  }, [fullscreen, fullscreenClosing]);

  // GSAP smooth bottom "Edit your diagrams" textarea drawer
  useLayoutEffect(() => {
    if (!fullscreen) {
      editorMountedRef.current = false;
      return;
    }
    if (fullscreenClosing) return;
    const drawerEl = editorDrawerRef.current;
    if (!drawerEl) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    gsap.killTweensOf(drawerEl);

    if (!editorMountedRef.current || reduce) {
      editorMountedRef.current = true;
      gsap.set(drawerEl, {
        height: isEditing ? 'auto' : 0,
        opacity: isEditing ? 1 : 0,
        y: 0,
      });
      return;
    }

    if (isEditing) {
      gsap.fromTo(
        drawerEl,
        { height: 0, opacity: 0, y: 14 },
        {
          height: 'auto',
          opacity: 1,
          y: 0,
          duration: 0.42,
          ease: 'expo.out',
          clearProps: 'transform',
          force3D: true,
        }
      );
    } else {
      gsap.to(drawerEl, {
        height: 0,
        opacity: 0,
        y: 10,
        duration: 0.28,
        ease: 'power3.inOut',
        force3D: true,
      });
    }
  }, [fullscreen, fullscreenClosing, isEditing]);

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
    setIsEditing(false);
    setFullscreenClosing(false);
    setFullscreen(true);
  };

  const closeFullscreen = () => {
    if (fullscreenClosing) return;
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
    await navigator.clipboard.writeText(fullscreen ? draftCode : code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const targetUrl = fullscreen ? fullscreenUrl : inlineUrl;
    if (!targetUrl) return;
    void downloadImageAsPng(targetUrl, 'diagram');
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
      ) : hasError || !inlineUrl ? (
        <pre className="modern-scrollbar m-0 max-h-[380px] overflow-auto bg-white p-4 font-mono text-[13px] leading-6 text-slate-800">
          <code>{code}</code>
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
            src={inlineUrl}
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

      {/* Fullscreen Interactive Diagram Editor Modal (Responsive Mobile & Desktop) */}
      {(fullscreen || fullscreenClosing) &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={fullscreenShellRef}
            className="fixed inset-0 z-[999999] flex h-[100dvh] w-screen flex-col overflow-hidden bg-white dark:bg-[#0b0d11]"
          >
            {/* Top Toolbar */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 sm:px-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeFullscreen}
                  title="Close"
                  aria-label="Close"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditing(prev => !prev)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ring-1 transition-colors sm:text-sm ${
                    isEditing
                      ? 'bg-slate-900 text-white ring-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:ring-slate-100'
                      : 'bg-slate-100 text-slate-800 ring-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700'
                  }`}
                >
                  <PenLine className="h-3.5 w-3.5" />
                  <span>Edit your diagrams</span>
                </button>
              </div>

              <div className="flex items-center gap-1 sm:gap-1.5">
                {/* Zoom In / Out Controls */}
                <div className="inline-flex h-9 items-center rounded-lg bg-slate-100 p-0.5 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:ring-slate-700">
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
              className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-white p-3 sm:p-6"
            >
              {fullscreenUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={fullscreenUrl}
                  alt="Diagram fullscreen"
                  draggable={false}
                  style={{
                    transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
                    cursor: zoom > 1 ? 'grab' : 'zoom-in',
                  }}
                  className="h-full w-full select-none object-contain transition-transform duration-150 ease-out"
                />
              ) : (
                <span className="text-xs font-medium text-slate-400">
                  Enter Mermaid syntax below to preview
                </span>
              )}
            </div>

            {/* Smooth GSAP Bottom "Edit your diagrams" Textarea Drawer */}
            <div
              ref={editorDrawerRef}
              className="shrink-0 overflow-hidden border-t border-slate-200 bg-slate-50/90 dark:border-slate-800 dark:bg-[#0d1117]"
            >
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-1.5 p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Edit your diagrams
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Done
                  </button>
                </div>
                <textarea
                  value={draftCode}
                  onChange={e => setDraftCode(e.target.value)}
                  spellCheck={false}
                  placeholder="flowchart TD..."
                  style={{ outline: 'none' }}
                  className="modern-scrollbar h-[28dvh] min-h-[130px] max-h-[240px] w-full resize-none rounded-xl border border-slate-200 bg-white p-3 font-mono text-[13px] leading-5 text-slate-900 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-[#11161f] dark:text-slate-100 dark:focus:border-slate-500"
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
