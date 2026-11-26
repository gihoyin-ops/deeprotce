'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { Download, X } from '@/components/ui/icons';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import { downloadImageAsPng } from '@/lib/images/client-webp';

interface GlobalImagePreviewModalProps {
  isOpen: boolean;
  src: string;
  alt?: string;
  fileName?: string;
  onClose: () => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

export default function GlobalImagePreviewModal({
  isOpen,
  src,
  alt = 'Image preview',
  fileName,
  onClose
}: GlobalImagePreviewModalProps) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  }>({ active: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const suppressBackdropClickRef = useRef(false);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetView();
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(MAX_ZOOM, +(z + 0.35).toFixed(2)));
      if (e.key === '-') setZoom(z => Math.max(MIN_ZOOM, +(z - 0.35).toFixed(2)));
      if (e.key === '0') resetView();
    };
    window.addEventListener('keydown', onKeyDown);

    if (!prefersReducedMotion()) {
      if (backdropRef.current) {
        gsap.fromTo(
          backdropRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.22, ease: 'power2.out' }
        );
      }
      if (imgRef.current) {
        gsap.fromTo(
          imgRef.current,
          { opacity: 0, scale: 0.92 },
          { opacity: 1, scale: 1, duration: 0.32, ease: 'expo.out', clearProps: 'transform' }
        );
      }
    }

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, resetView]);

  if (!isOpen || !src || typeof document === 'undefined') return null;

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.22 : -0.22;
    setZoom(prev => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(prev + delta).toFixed(2)));
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (zoom > 1.05) {
      resetView();
    } else {
      setZoom(2.2);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (zoom <= 1) return;
    dragRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      originX: offset.x,
      originY: offset.y
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.hypot(dx, dy) > 4) {
      dragRef.current.moved = true;
      suppressBackdropClickRef.current = true;
    }
    setOffset({
      x: dragRef.current.originX + dx,
      y: dragRef.current.originY + dy
    });
  };

  const handlePointerUp = () => {
    dragRef.current.active = false;
    if (suppressBackdropClickRef.current) {
      window.setTimeout(() => {
        suppressBackdropClickRef.current = false;
      }, 40);
    }
  };

  const handleBackdropClick = () => {
    if (suppressBackdropClickRef.current) return;
    onClose();
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dragRef.current.moved || suppressBackdropClickRef.current) {
      dragRef.current.moved = false;
      return;
    }
    if (zoom > 1.05) {
      resetView();
    } else {
      setZoom(2);
    }
  };

  return createPortal(
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      data-no-marquee="true"
      onMouseDown={e => e.stopPropagation()}
      onClick={handleBackdropClick}
      onWheel={handleWheel}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md"
    >
      {/* Top-right controls: Download PNG and close */}
      <div
        onClick={e => e.stopPropagation()}
        className="fixed right-4 top-4 z-10 flex items-center gap-2"
      >
        {zoom !== 1 && (
          <button
            type="button"
            onClick={resetView}
            className="h-9 rounded-full bg-white/10 px-3 text-xs font-medium text-white/90 backdrop-blur-xs transition-colors hover:bg-white/20"
          >
            {Math.round(zoom * 100)}%
          </button>
        )}
        <button
          type="button"
          onClick={() => void downloadImageAsPng(src, fileName || alt)}
          aria-label="Download as PNG"
          title="Download PNG"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/90 backdrop-blur-xs transition-colors hover:bg-white/20"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Just the centered image, no card or background bs */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        onMouseDown={e => e.stopPropagation()}
        onClick={handleImageClick}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
          cursor: zoom > 1 ? 'grab' : 'zoom-in'
        }}
        className="max-h-[90dvh] max-w-[92vw] select-none object-contain transition-transform duration-150 ease-out"
      />
    </div>,
    document.body
  );
}
