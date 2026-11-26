'use client';

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { Check, Copy, Maximize2, X } from '@/components/ui/icons';

interface MermaidDiagramBlockProps {
  code: string;
  isStreaming?: boolean;
}

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

  const imgRef = useRef<HTMLImageElement | null>(null);
  const fullscreenShellRef = useRef<HTMLDivElement | null>(null);

  const diagramUrl = useMemo(() => {
    if (isStreaming) return '';
    const encoded = encodeMermaidBase64(code.trim());
    return encoded ? `https://mermaid.ink/svg/${encoded}?bgColor=!ffffff` : '';
  }, [code, isStreaming]);

  useLayoutEffect(() => {
    if (!loaded || !imgRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      imgRef.current,
      { opacity: 0, scale: 0.985 },
      { opacity: 1, scale: 1, duration: 0.36, ease: 'expo.out', clearProps: 'transform', force3D: true }
    );
  }, [loaded]);

  useLayoutEffect(() => {
    if (!fullscreen || !fullscreenShellRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      fullscreenShellRef.current,
      { opacity: 0, scale: 0.985 },
      { opacity: 1, scale: 1, duration: 0.28, ease: 'expo.out', clearProps: 'transform', force3D: true }
    );
  }, [fullscreen]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="group/diagram not-prose relative mb-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-white">
      {/* Subtle floating top-right actions on hover */}
      {!isStreaming && (
        <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover/diagram:opacity-100 sm:group-focus-within/diagram:opacity-100">
          <button
            type="button"
            onClick={() => void handleCopy()}
            title={copied ? 'Copied' : 'Copy diagram source'}
            aria-label={copied ? 'Copied' : 'Copy diagram source'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white/90 text-slate-600 shadow-xs backdrop-blur-xs transition-colors hover:bg-slate-50 hover:text-slate-950"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {!hasError && loaded && (
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              title="Expand diagram"
              aria-label="Expand diagram"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white/90 text-slate-600 shadow-xs backdrop-blur-xs transition-colors hover:bg-slate-50 hover:text-slate-950"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {isStreaming ? (
        <div className="flex h-44 items-center justify-center bg-white">
          <span className="text-xs font-medium text-slate-400">Drawing diagram...</span>
        </div>
      ) : hasError || !diagramUrl ? (
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
            onClick={() => loaded && setFullscreen(true)}
            className={`max-h-[520px] max-w-full cursor-zoom-in object-contain transition-opacity duration-200 ${
              loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>
      )}

      {/* Fullscreen Diagram Modal */}
      {fullscreen &&
        diagramUrl &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={fullscreenShellRef}
            onClick={() => setFullscreen(false)}
            className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <div
              onClick={e => e.stopPropagation()}
              className="relative flex h-[88dvh] w-[92vw] items-center justify-center overflow-hidden rounded-2xl bg-white p-6 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                aria-label="Close diagram"
                className="fixed right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-xs transition-colors hover:bg-white/25"
              >
                <X className="h-4 w-4" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={diagramUrl}
                alt="Diagram fullscreen"
                className="h-full w-full object-contain"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
