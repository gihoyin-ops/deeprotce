'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import NextImage from 'next/image';
import { gsap } from 'gsap';
import {
  ArrowUp,
  ChevronLeft,
  Download,
  PenLine,
  RefreshCw,
  Scan,
  Trash2,
  X,
} from '@/components/ui/icons';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import { type ExtractedGeneratedImage } from '@/lib/images/image-generation';
import { type ImageAspectRatio } from '@/lib/images/image-aspect-ratio';
import {
  type AnnotationStroke,
  type EditPin,
  type ImageStudioEditRequest,
  type ImageStudioMode,
  type StrokePoint,
  buildSpatialPinPrompt,
  downloadImageSrc,
  drawStrokePolyline,
  exportAnnotatedCompositePng,
  exportCleanSourcePng,
  exportCompactThumbnailJpeg,
  exportOpenAiAlphaMaskPng,
  loadImageForCanvas,
} from './image-studio-export';

export interface GeneratedImagePreviewModalProps {
  isOpen: boolean;
  image: ExtractedGeneratedImage | null;
  initialMode?: ImageStudioMode;
  isBusy?: boolean;
  onClose: () => void;
  onSubmitEdit: (request: ImageStudioEditRequest) => void | Promise<void>;
}

const ANNOTATE_COLORS = [
  { id: 'clay', label: 'Terracotta', hex: '#e28666' },
  { id: 'cream', label: 'Cream', hex: '#faf6f0' },
  { id: 'obsidian', label: 'Charcoal', hex: '#1c1917' },
  { id: 'sky', label: 'Sky blue', hex: '#38bdf8' },
  { id: 'sage', label: 'Sage green', hex: '#4ade80' },
];

const RESIZE_RATIOS: {
  value: Exclude<ImageAspectRatio, 'auto'>;
  label: string;
  ratio: number;
  w: number;
  h: number;
}[] = [
  { value: '1:1', label: '1:1', ratio: 1, w: 14, h: 14 },
  { value: '3:4', label: '3:4', ratio: 3 / 4, w: 11, h: 15 },
  { value: '9:16', label: '9:16', ratio: 9 / 16, w: 9, h: 16 },
  { value: '4:3', label: '4:3', ratio: 4 / 3, w: 15, h: 11 },
  { value: '16:9', label: '16:9', ratio: 16 / 9, w: 16, h: 9 },
];

const MODE_LABELS: Record<Exclude<ImageStudioMode, 'view'>, string> = {
  edit: 'Edit',
  annotate: 'Anotasi',
  resize: 'Ubah ukuran',
  remove: 'Hapus objek',
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

function getRatioFromDimensions(w: number, h: number): Exclude<ImageAspectRatio, 'auto'> {
  const r = w / Math.max(1, h);
  let best = RESIZE_RATIOS[0];
  let bestDiff = Math.abs(r - best.ratio);
  for (const item of RESIZE_RATIOS) {
    const diff = Math.abs(r - item.ratio);
    if (diff < bestDiff) {
      best = item;
      bestDiff = diff;
    }
  }
  return best.value;
}

export default function GeneratedImagePreviewModal({
  isOpen,
  image,
  initialMode = 'view',
  isBusy = false,
  onClose,
  onSubmitEdit,
}: GeneratedImagePreviewModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const transformWrapRef = useRef<HTMLDivElement>(null);
  const imageBoxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const bottomBarRef = useRef<HTMLDivElement>(null);
  const annotatePromptWrapRef = useRef<HTMLDivElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const annotateTextareaRef = useRef<HTMLTextAreaElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const mobilePinInputRef = useRef<HTMLInputElement>(null);
  const resizeGuideRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const isClosingRef = useRef(false);

  const [mode, setMode] = useState<ImageStudioMode>(initialMode);
  const [naturalSize, setNaturalSize] = useState({ width: 1024, height: 1024 });
  const [boxSize, setBoxSize] = useState({ width: 320, height: 320 });
  const [statusAnnouncement, setStatusAnnouncement] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Zoom & Pan state
  const [viewTransform, setViewTransform] = useState({ scale: 1, tx: 0, ty: 0 });
  const viewTransformRef = useRef(viewTransform);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{
    dist: number;
    midX: number;
    midY: number;
    startScale: number;
    startTx: number;
    startTy: number;
  } | null>(null);
  const panDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
  } | null>(null);
  const tapCandidateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const lastTapTimeRef = useRef(0);
  const lastTouchDoubleTapAtRef = useRef(0);
  const isSpacePressedRef = useRef(false);

  // Mode: Edit (Tap-to-pin + compact textarea)
  const [pins, setPins] = useState<EditPin[]>([]);
  const [activePinId, setActivePinId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');

  // Mode: Annotate (Draw / Mask / Eraser -> Done -> Slide-up compact textarea)
  const [annotateStage, setAnnotateStage] = useState<'drawing' | 'prompt'>('drawing');
  const [annotateTool, setAnnotateTool] = useState<'draw' | 'mask' | 'erase'>('draw');
  const [annotateColor, setAnnotateColor] = useState(ANNOTATE_COLORS[0].hex);
  const [annotateBrushPx, setAnnotateBrushPx] = useState(14);
  const [annotateStrokes, setAnnotateStrokes] = useState<AnnotationStroke[]>([]);
  const [annotatePrompt, setAnnotatePrompt] = useState('');

  // Mode: Resize
  const [resizeRatio, setResizeRatio] = useState<Exclude<ImageAspectRatio, 'auto'>>('1:1');
  const [resizeNote, setResizeNote] = useState('');

  // Mode: Remove (Minimalist mask size + send)
  const [removeBrushPx, setRemoveBrushPx] = useState(26);
  const [removeStrokes, setRemoveStrokes] = useState<AnnotationStroke[]>([]);

  // Active live drawing stroke
  const activeStrokeRef = useRef<AnnotationStroke | null>(null);
  const [pointerPreview, setPointerPreview] = useState<{
    x: number;
    y: number;
    visible: boolean;
  }>({ x: 0, y: 0, visible: false });

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    viewTransformRef.current = viewTransform;
  }, [viewTransform]);

  const clampTransform = useCallback(
    (nextScale: number, nextTx: number, nextTy: number) => {
      const clampedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      if (clampedScale <= 1.01) {
        return { scale: 1, tx: 0, ty: 0 };
      }
      const vpW = viewportRef.current?.clientWidth || 800;
      const vpH = viewportRef.current?.clientHeight || 600;
      const imgW = imageBoxRef.current?.offsetWidth || boxSize.width || 320;
      const imgH = imageBoxRef.current?.offsetHeight || boxSize.height || 320;

      const maxTx = Math.max(0, (imgW * clampedScale - Math.min(vpW * 0.84, imgW)) / 2 + 24);
      const maxTy = Math.max(0, (imgH * clampedScale - Math.min(vpH * 0.84, imgH)) / 2 + 24);
      return {
        scale: clampedScale,
        tx: clamp(nextTx, -maxTx, maxTx),
        ty: clamp(nextTy, -maxTy, maxTy),
      };
    },
    [boxSize.width, boxSize.height]
  );

  const animateZoomTo = useCallback(
    (targetScale: number, targetTx = 0, targetTy = 0) => {
      const clamped = clampTransform(targetScale, targetTx, targetTy);
      if (prefersReducedMotion()) {
        setViewTransform(clamped);
        return;
      }
      const proxy = { ...viewTransformRef.current };
      gsap.to(proxy, {
        scale: clamped.scale,
        tx: clamped.tx,
        ty: clamped.ty,
        duration: 0.28,
        ease: 'power3.out',
        onUpdate: () => {
          setViewTransform({
            scale: proxy.scale,
            tx: proxy.tx,
            ty: proxy.ty,
          });
        },
      });
    },
    [clampTransform]
  );

  const requestAnimatedClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    const dialogEl = dialogRef.current;
    const reduce = prefersReducedMotion();

    if (!dialogEl || reduce) {
      if (dialogEl?.open) dialogEl.close();
      onCloseRef.current();
      return;
    }

    const targets = [stageRef.current, topBarRef.current, bottomBarRef.current].filter(Boolean);
    gsap.killTweensOf(targets);
    gsap.to(targets, {
      opacity: 0,
      scale: 0.965,
      duration: 0.17,
      ease: 'power2.in',
      onComplete: () => {
        if (dialogEl.open) dialogEl.close();
        onCloseRef.current();
      },
    });
  }, []);

  // Open native modal <dialog> & run GSAP entrance
  useEffect(() => {
    const dialogEl = dialogRef.current;
    if (!dialogEl || !isOpen || !image) return;

    if (!dialogEl.open) {
      dialogEl.showModal();
    }

    const reduce = prefersReducedMotion();
    if (!reduce) {
      if (stageRef.current) {
        gsap.fromTo(
          stageRef.current,
          { opacity: 0, scale: 0.94 },
          { opacity: 1, scale: 1, duration: 0.32, ease: 'expo.out', clearProps: 'transform,opacity' }
        );
      }
      if (topBarRef.current) {
        gsap.fromTo(
          topBarRef.current,
          { opacity: 0, y: -10 },
          { opacity: 1, y: 0, duration: 0.28, ease: 'expo.out', clearProps: 'transform,opacity' }
        );
      }
      if (bottomBarRef.current) {
        gsap.fromTo(
          bottomBarRef.current,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.3, ease: 'expo.out', clearProps: 'transform,opacity' }
        );
      }
    }

    const handleNativeClose = () => {
      dialogEl.returnValue = '';
    };
    dialogEl.addEventListener('close', handleNativeClose);
    return () => {
      dialogEl.removeEventListener('close', handleNativeClose);
    };
  }, [isOpen, image]);

  // Animate mode transitions & slide-up compact bars
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (bottomBarRef.current) {
      gsap.fromTo(
        bottomBarRef.current,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.28, ease: 'expo.out', clearProps: 'transform,opacity' }
      );
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== 'annotate' || annotateStage !== 'prompt') return;
    const el = annotatePromptWrapRef.current;
    if (el && !prefersReducedMotion()) {
      gsap.fromTo(
        el,
        { opacity: 0, y: 30, scale: 0.98 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.34,
          ease: 'expo.out',
          clearProps: 'transform,opacity',
        }
      );
    }
    const raf = window.requestAnimationFrame(() => {
      annotateTextareaRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [mode, annotateStage]);

  useEffect(() => {
    if (mode !== 'edit') return;
    const raf = window.requestAnimationFrame(() => {
      if (activePinId) {
        if (typeof window !== 'undefined' && window.innerWidth < 640) {
          mobilePinInputRef.current?.focus();
        } else {
          pinInputRef.current?.focus();
        }
      } else {
        editTextareaRef.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(raf);
  }, [mode, activePinId]);

  useEffect(() => {
    if (mode !== 'resize' || !resizeGuideRef.current || prefersReducedMotion()) return;
    gsap.fromTo(
      resizeGuideRef.current,
      { scale: 0.96, opacity: 0.72 },
      { scale: 1, opacity: 1, duration: 0.26, ease: 'power3.out', clearProps: 'transform' }
    );
  }, [mode, resizeRatio]);

  // Observe rendered image box size to keep overlay canvas crisp and aligned
  useEffect(() => {
    const boxEl = imageBoxRef.current;
    if (!boxEl) return;

    const measure = () => {
      const w = Math.max(1, Math.round(boxEl.offsetWidth));
      const h = Math.max(1, Math.round(boxEl.offsetHeight));
      setBoxSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };

    const raf = window.requestAnimationFrame(measure);
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(boxEl);

    return () => {
      window.cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [naturalSize, mode]);

  // Repaint annotation or removal strokes onto the HiDPI overlay canvas
  const redrawOverlayCanvas = useCallback(
    (extraStroke?: AnnotationStroke | null) => {
      const canvasEl = canvasRef.current;
      const boxEl = imageBoxRef.current;
      if (!canvasEl || !boxEl) return;

      const width = Math.max(1, Math.round(boxEl.offsetWidth));
      const height = Math.max(1, Math.round(boxEl.offsetHeight));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      if (canvasEl.width !== Math.round(width * dpr) || canvasEl.height !== Math.round(height * dpr)) {
        canvasEl.width = Math.round(width * dpr);
        canvasEl.height = Math.round(height * dpr);
      }

      const ctx = canvasEl.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const minDim = Math.min(width, height);
      const list =
        mode === 'remove'
          ? [...removeStrokes, ...(extraStroke ? [extraStroke] : [])]
          : mode === 'annotate'
            ? [...annotateStrokes, ...(extraStroke ? [extraStroke] : [])]
            : [];

      for (const stroke of list) {
        if (stroke.points.length === 0) continue;
        const lineWidth = Math.max(3, stroke.size * minDim);

        if (stroke.kind === 'erase') {
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = '#000000';
          ctx.fillStyle = '#000000';
          drawStrokePolyline(ctx, stroke.points, width, height, lineWidth, true);
          ctx.restore();
        } else if (stroke.kind === 'mask') {
          ctx.save();
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = mode === 'remove' ? 0.56 : 0.44;
          ctx.strokeStyle = mode === 'remove' ? '#ef4444' : '#e28666';
          ctx.fillStyle = mode === 'remove' ? '#ef4444' : '#e28666';
          drawStrokePolyline(ctx, stroke.points, width, height, lineWidth, true);
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = stroke.color;
          ctx.fillStyle = stroke.color;
          drawStrokePolyline(ctx, stroke.points, width, height, lineWidth, true);
          ctx.restore();
        }
      }

      ctx.restore();
    },
    [mode, annotateStrokes, removeStrokes]
  );

  useEffect(() => {
    redrawOverlayCanvas();
  }, [redrawOverlayCanvas, boxSize]);

  // Non-passive wheel zoom listener + keyboard zoom / spacebar pan shortcuts
  useEffect(() => {
    const vpEl = viewportRef.current;
    if (!vpEl || !isOpen) return;

    const handleWheel = (event: WheelEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('textarea, input, .dc-lb-toolbar-scroll')
      ) {
        return;
      }
      event.preventDefault();
      const current = viewTransformRef.current;
      const factor = event.ctrlKey
        ? 1 - event.deltaY * 0.008
        : event.deltaY < 0
          ? 1.12
          : 0.89;
      const nextScale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);

      const rect = vpEl.getBoundingClientRect();
      const cx = event.clientX - (rect.left + rect.width / 2);
      const cy = event.clientY - (rect.top + rect.height / 2);
      const ratio = nextScale / current.scale;
      const nextTx = nextScale <= 1.01 ? 0 : cx - (cx - current.tx) * ratio;
      const nextTy = nextScale <= 1.01 ? 0 : cy - (cy - current.ty) * ratio;

      setViewTransform(clampTransform(nextScale, nextTx, nextTy));
    };

    vpEl.addEventListener('wheel', handleWheel, { passive: false });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        const active = document.activeElement;
        if (!active?.closest('input, textarea')) {
          isSpacePressedRef.current = true;
        }
      }
      if (document.activeElement?.closest('input, textarea')) return;

      if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        animateZoomTo(viewTransformRef.current.scale + 0.45, viewTransformRef.current.tx, viewTransformRef.current.ty);
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        animateZoomTo(viewTransformRef.current.scale - 0.45, viewTransformRef.current.tx, viewTransformRef.current.ty);
      } else if (event.key === '0') {
        event.preventDefault();
        animateZoomTo(1, 0, 0);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        isSpacePressedRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      vpEl.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, clampTransform, animateZoomTo]);

  // Roving keyboard arrow fallback inside toolbar when native focusGroup is unavailable
  useEffect(() => {
    const bar = toolbarRef.current;
    if (!bar || 'focusGroup' in HTMLElement.prototype) return;

    const getItems = () =>
      Array.from(bar.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));

    const items = getItems();
    items.forEach((btn, idx) => {
      btn.tabIndex = idx === 0 ? 0 : -1;
    });

    const handleFocusIn = (event: FocusEvent) => {
      const all = getItems();
      const target = event.target as HTMLButtonElement | null;
      if (target && all.includes(target)) {
        all.forEach((btn) => {
          btn.tabIndex = btn === target ? 0 : -1;
        });
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const all = getItems();
      if (all.length === 0) return;
      const currentIdx = all.indexOf(document.activeElement as HTMLButtonElement);
      if (currentIdx === -1) return;

      let nextIdx = -1;
      if (event.key === 'ArrowRight') nextIdx = (currentIdx + 1) % all.length;
      else if (event.key === 'ArrowLeft') nextIdx = (currentIdx - 1 + all.length) % all.length;
      else if (event.key === 'Home') nextIdx = 0;
      else if (event.key === 'End') nextIdx = all.length - 1;

      if (nextIdx === -1) return;
      event.preventDefault();
      all.forEach((btn, idx) => {
        btn.tabIndex = idx === nextIdx ? 0 : -1;
      });
      all[nextIdx]?.focus();
    };

    bar.addEventListener('focusin', handleFocusIn);
    bar.addEventListener('keydown', handleKeyDown);
    return () => {
      bar.removeEventListener('focusin', handleFocusIn);
      bar.removeEventListener('keydown', handleKeyDown);
    };
  }, [mode, annotateStage]);

  const toNormalizedImagePoint = useCallback((clientX: number, clientY: number): StrokePoint | null => {
    const boxEl = imageBoxRef.current;
    if (!boxEl) return null;
    const rect = boxEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: clamp((clientX - rect.left) / rect.width, 0, 1),
      y: clamp((clientY - rect.top) / rect.height, 0, 1),
    };
  }, []);

  const isDrawingMode =
    (mode === 'annotate' && annotateStage === 'drawing') || mode === 'remove';

  const handleStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('[data-lb-interactive="true"]')) {
      return;
    }

    activePointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    // 2-finger pinch-to-zoom + 2-finger pan across ALL modes
    if (activePointersRef.current.size === 2) {
      if (activeStrokeRef.current && activeStrokeRef.current.points.length <= 5) {
        activeStrokeRef.current = null;
        redrawOverlayCanvas(null);
      }
      tapCandidateRef.current = null;
      panDragRef.current = null;

      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const midX = (pts[0].x + pts[1].x) * 0.5;
      const midY = (pts[0].y + pts[1].y) * 0.5;
      pinchStateRef.current = {
        dist: Math.max(1, dist),
        midX,
        midY,
        startScale: viewTransformRef.current.scale,
        startTx: viewTransformRef.current.tx,
        startTy: viewTransformRef.current.ty,
      };
      return;
    }

    if (activePointersRef.current.size !== 1) return;

    // Middle mouse or Space+Drag always pans
    if (event.button === 1 || (isSpacePressedRef.current && viewTransformRef.current.scale > 1)) {
      panDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTx: viewTransformRef.current.tx,
        startTy: viewTransformRef.current.ty,
      };
      return;
    }

    if (isDrawingMode) {
      const pt = toNormalizedImagePoint(event.clientX, event.clientY);
      const boxEl = imageBoxRef.current;
      if (!pt || !boxEl) return;

      const rect = boxEl.getBoundingClientRect();
      const insideImage =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!insideImage) return;

      const minRendered = Math.max(120, Math.min(boxSize.width, boxSize.height));
      const brushPx = mode === 'remove' ? removeBrushPx : annotateBrushPx;
      const normalizedSize = clamp(brushPx / minRendered, 0.01, 0.16);

      const newStroke: AnnotationStroke = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: mode === 'remove' ? 'mask' : annotateTool,
        color: annotateColor,
        size: normalizedSize,
        points: [pt],
      };

      activeStrokeRef.current = newStroke;
      redrawOverlayCanvas(newStroke);
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // ignore pointer capture issues
      }
      return;
    }

    if (mode === 'edit') {
      const boxEl = imageBoxRef.current;
      if (boxEl) {
        const rect = boxEl.getBoundingClientRect();
        const inside =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;
        if (inside) {
          tapCandidateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
          };
        }
      }
      if (viewTransformRef.current.scale > 1) {
        panDragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startTx: viewTransformRef.current.tx,
          startTy: viewTransformRef.current.ty,
        };
      }
      return;
    }

    // 'view' or 'resize' mode
    if (viewTransformRef.current.scale > 1) {
      panDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTx: viewTransformRef.current.tx,
        startTy: viewTransformRef.current.ty,
      };
    }

    if (mode === 'view') {
      const boxEl = imageBoxRef.current;
      const rect = boxEl?.getBoundingClientRect();
      const inside =
        rect &&
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!inside) {
        tapCandidateRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
        };
      } else if (event.pointerType === 'touch') {
        const now = Date.now();
        if (now - lastTapTimeRef.current < 280) {
          lastTapTimeRef.current = 0;
          lastTouchDoubleTapAtRef.current = now;
          animateZoomTo(viewTransformRef.current.scale > 1.15 ? 1 : 2.1, 0, 0);
        } else {
          lastTapTimeRef.current = now;
        }
      }
    }
  };

  const handleStagePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && isDrawingMode) {
      const boxEl = imageBoxRef.current;
      const rect = boxEl?.getBoundingClientRect();
      const inside =
        rect &&
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      setPointerPreview({
        x: event.clientX,
        y: event.clientY,
        visible: Boolean(inside),
      });
    }

    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    if (activePointersRef.current.size === 2 && pinchStateRef.current) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.max(1, Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y));
      const midX = (pts[0].x + pts[1].x) * 0.5;
      const midY = (pts[0].y + pts[1].y) * 0.5;
      const p = pinchStateRef.current;

      const nextScale = clamp(p.startScale * (dist / p.dist), MIN_SCALE, MAX_SCALE);
      const nextTx = p.startTx + (midX - p.midX);
      const nextTy = p.startTy + (midY - p.midY);
      setViewTransform(clampTransform(nextScale, nextTx, nextTy));
      return;
    }

    if (
      tapCandidateRef.current &&
      tapCandidateRef.current.pointerId === event.pointerId &&
      Math.hypot(
        event.clientX - tapCandidateRef.current.startX,
        event.clientY - tapCandidateRef.current.startY
      ) > 8
    ) {
      tapCandidateRef.current.moved = true;
    }

    if (activeStrokeRef.current) {
      const pt = toNormalizedImagePoint(event.clientX, event.clientY);
      if (!pt) return;
      const pts = activeStrokeRef.current.points;
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 0.004) {
        pts.push(pt);
        redrawOverlayCanvas(activeStrokeRef.current);
      }
      return;
    }

    if (panDragRef.current && panDragRef.current.pointerId === event.pointerId) {
      const drag = panDragRef.current;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      setViewTransform(
        clampTransform(viewTransformRef.current.scale, drag.startTx + dx, drag.startTy + dy)
      );
    }
  };

  const handleStagePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchStateRef.current = null;
    }

    if (activeStrokeRef.current) {
      const finished = activeStrokeRef.current;
      activeStrokeRef.current = null;
      if (mode === 'remove') {
        setRemoveStrokes((prev) => [...prev, finished]);
      } else if (mode === 'annotate') {
        setAnnotateStrokes((prev) => [...prev, finished]);
      }
    }

    if (panDragRef.current?.pointerId === event.pointerId) {
      panDragRef.current = null;
    }

    const tap = tapCandidateRef.current;
    if (tap && tap.pointerId === event.pointerId) {
      tapCandidateRef.current = null;
      if (!tap.moved) {
        if (mode === 'view') {
          requestAnimatedClose();
        } else if (mode === 'edit') {
          const pt = toNormalizedImagePoint(event.clientX, event.clientY);
          if (pt) {
            const newPin: EditPin = {
              id: `pin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              x: pt.x,
              y: pt.y,
              note: '',
            };
            setPins((prev) => [...prev, newPin]);
            setActivePinId(newPin.id);
            setStatusAnnouncement(`Added edit pin ${pins.length + 1}`);
          }
        }
      }
    }
  };

  const handleStagePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchStateRef.current = null;
    }
    if (panDragRef.current?.pointerId === event.pointerId) {
      panDragRef.current = null;
    }
    if (tapCandidateRef.current?.pointerId === event.pointerId) {
      tapCandidateRef.current = null;
    }
    if (activeStrokeRef.current) {
      activeStrokeRef.current = null;
      redrawOverlayCanvas(null);
    }
  };

  const switchMode = (nextMode: ImageStudioMode) => {
    setMode(nextMode);
    setPointerPreview((prev) => ({ ...prev, visible: false }));
    if (nextMode === 'annotate') {
      setAnnotateStage('drawing');
    }
    if (nextMode !== 'view') {
      setStatusAnnouncement(`Switched to ${MODE_LABELS[nextMode]} mode`);
    } else {
      setStatusAnnouncement('Preview mode');
    }
  };

  const activePinIndex = pins.findIndex((p) => p.id === activePinId);
  const activePin = activePinIndex >= 0 ? pins[activePinIndex] : null;

  const canSendEdit =
    editPrompt.trim().length > 0 || pins.some((pin) => pin.note.trim().length > 0);
  const canSendAnnotate =
    annotateStrokes.length > 0 || annotatePrompt.trim().length > 0;
  const canSendRemove = removeStrokes.length > 0;

  const submitStudioEdit = async () => {
    if (!image || isExporting || isBusy) return;
    setIsExporting(true);

    try {
      const img = await loadImageForCanvas(image.src);
      const exportedSource = exportCleanSourcePng(img, 1280);
      const thumbnailDataUrl = exportCompactThumbnailJpeg(img, 220);
      const natW = img.naturalWidth || naturalSize.width || 1024;
      const natH = img.naturalHeight || naturalSize.height || 1024;
      const baseRatio = getRatioFromDimensions(natW, natH);

      if (mode === 'edit') {
        if (!canSendEdit) return;
        const modelPrompt = buildSpatialPinPrompt(pins, editPrompt);
        const pinSummary = pins
          .map((p, idx) => (p.note.trim() ? `[${idx + 1}] ${p.note.trim()}` : ''))
          .filter(Boolean)
          .join(' • ');
        const userDisplayText = [pinSummary, editPrompt.trim()].filter(Boolean).join(' — ') || modelPrompt;

        await onSubmitEdit({
          mode: 'edit',
          userDisplayText,
          modelPrompt,
          aspectRatio: baseRatio,
          sourceImageDataUrl: exportedSource.dataUrl,
          thumbnailDataUrl,
        });
        requestAnimatedClose();
        return;
      }

      if (mode === 'annotate') {
        if (!canSendAnnotate) return;
        const hasMaskStrokes = annotateStrokes.some((s) => s.kind === 'mask');
        const hasDrawStrokes = annotateStrokes.some((s) => s.kind === 'draw');

        const exportedAnnotated = hasDrawStrokes
          ? exportAnnotatedCompositePng(img, annotateStrokes, 1280, false)
          : null;
        const primaryExport = exportedAnnotated ?? exportedSource;
        const maskDataUrl = hasMaskStrokes
          ? exportOpenAiAlphaMaskPng(primaryExport.width, primaryExport.height, annotateStrokes)
          : undefined;

        const cleanInstr = annotatePrompt.trim();
        const modelPrompt = cleanInstr
          ? hasMaskStrokes
            ? `Edit the masked/highlighted region of the image as follows: ${cleanInstr}`
            : hasDrawStrokes
              ? `Follow the visual annotations/drawings overlaid on the image and apply this edit cleanly (do not leave the sketch lines in the final image): ${cleanInstr}`
              : cleanInstr
          : 'Refine and cleanly realize the annotated and masked regions in the image naturally.';

        await onSubmitEdit({
          mode: 'annotate',
          userDisplayText: cleanInstr || 'Edit image based on annotations',
          modelPrompt,
          aspectRatio: baseRatio,
          sourceImageDataUrl: primaryExport.dataUrl,
          maskDataUrl,
          thumbnailDataUrl,
        });
        requestAnimatedClose();
        return;
      }

      if (mode === 'resize') {
        const extra = resizeNote.trim();
        const modelPrompt = extra
          ? `Reframe and adapt this image cleanly to ${resizeRatio} aspect ratio while preserving the main subject and style. ${extra}`
          : `Reframe and naturally extend/adapt this image to a ${resizeRatio} aspect ratio while keeping the subject, lighting, and artistic style consistent.`;

        await onSubmitEdit({
          mode: 'resize',
          userDisplayText: extra
            ? `Resize to ${resizeRatio} — ${extra}`
            : `Resize image to ${resizeRatio}`,
          modelPrompt,
          aspectRatio: resizeRatio,
          sourceImageDataUrl: exportedSource.dataUrl,
          thumbnailDataUrl,
        });
        requestAnimatedClose();
        return;
      }

      if (mode === 'remove') {
        if (!canSendRemove) return;
        const maskDataUrl = exportOpenAiAlphaMaskPng(
          exportedSource.width,
          exportedSource.height,
          removeStrokes
        );

        await onSubmitEdit({
          mode: 'remove',
          userDisplayText: 'Remove masked object',
          modelPrompt:
            'Cleanly remove the masked object or region from the image and seamlessly reconstruct the natural background, textures, and lighting.',
          aspectRatio: baseRatio,
          sourceImageDataUrl: exportedSource.dataUrl,
          maskDataUrl,
          thumbnailDataUrl,
        });
        requestAnimatedClose();
      }
    } catch {
      setStatusAnnouncement('Could not prepare image edit. Try again.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen || !image) return null;

  const zoomPercent = Math.round(viewTransform.scale * 100);
  const selectedResizeOption =
    RESIZE_RATIOS.find((item) => item.value === resizeRatio) || RESIZE_RATIOS[0];

  // Compute live target crop/extend guide proportions over the rendered image
  const imageRatio = boxSize.width / Math.max(1, boxSize.height);
  const guideRatio = selectedResizeOption.ratio;
  const resizeGuideStyle: React.CSSProperties =
    guideRatio > imageRatio
      ? {
          width: '100%',
          height: `${clamp((imageRatio / guideRatio) * 100, 28, 100)}%`,
        }
      : {
          height: '100%',
          width: `${clamp((guideRatio / imageRatio) * 100, 28, 100)}%`,
        };

  const currentBrushPx = mode === 'remove' ? removeBrushPx : annotateBrushPx;
  const cursorPreviewDiameter = clamp(currentBrushPx * viewTransform.scale, 10, 120);

  return (
    <dialog
      ref={dialogRef}
      data-mobile-overlay="true"
      aria-label="Image preview and studio"
      onCancel={(event) => {
        event.preventDefault();
        if (mode === 'edit' && activePinId) {
          setActivePinId(null);
          return;
        }
        requestAnimatedClose();
      }}
      className="dc-img-lightbox"
    >
      <p role="status" className="sr-only">
        {statusAnnouncement}
      </p>

      {/* Top Floating Chrome (Zoom Left, Mode Chip Center, Download & Close Right) */}
      <div
        ref={topBarRef}
        className="pointer-events-none relative z-30 flex w-full items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-5"
      >
        <div
          data-lb-interactive="true"
          className="dc-lb-glass pointer-events-auto inline-flex items-center gap-0.5 rounded-full p-1"
        >
          <button
            type="button"
            onClick={() =>
              animateZoomTo(
                viewTransformRef.current.scale - 0.45,
                viewTransformRef.current.tx,
                viewTransformRef.current.ty
              )
            }
            disabled={viewTransform.scale <= MIN_SCALE + 0.02}
            aria-label="Zoom out"
            title="Zoom out (-)"
            className="dc-lb-btn h-8 w-8 sm:h-8 sm:w-8"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => animateZoomTo(1, 0, 0)}
            aria-label={`Reset zoom, currently ${zoomPercent}%`}
            title="Reset zoom (0)"
            className="dc-lb-btn px-2 text-[12px] font-semibold tabular-nums"
          >
            {zoomPercent}%
          </button>

          <button
            type="button"
            onClick={() =>
              animateZoomTo(
                viewTransformRef.current.scale + 0.45,
                viewTransformRef.current.tx,
                viewTransformRef.current.ty
              )
            }
            disabled={viewTransform.scale >= MAX_SCALE - 0.02}
            aria-label="Zoom in"
            title="Zoom in (+)"
            className="dc-lb-btn h-8 w-8 sm:h-8 sm:w-8"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>
        </div>

        {mode !== 'view' && (
          <div data-lb-interactive="true" className="pointer-events-auto">
            <button
              type="button"
              onClick={() => switchMode('view')}
              aria-label="Back to preview"
              className="dc-lb-glass dc-lb-btn px-3 text-[12.5px] font-semibold"
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.35} />
              <span>{MODE_LABELS[mode]}</span>
            </button>
          </div>
        )}

        <div
          data-lb-interactive="true"
          className="dc-lb-glass pointer-events-auto inline-flex items-center gap-1 rounded-full p-1"
        >
          <button
            type="button"
            onClick={() => downloadImageSrc(image.src, 0)}
            aria-label="Download image"
            title="Download"
            className="dc-lb-btn h-8 w-8"
          >
            <Download className="h-4 w-4" strokeWidth={2.15} />
          </button>
          <button
            type="button"
            onClick={requestAnimatedClose}
            aria-label="Close preview"
            title="Close (Esc)"
            className="dc-lb-btn h-8 w-8"
          >
            <X className="h-4.5 w-4.5" strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {/* Central Pure Image Canvas Stage */}
      <div
        ref={viewportRef}
        data-gesture-ignore="true"
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        onPointerCancel={handleStagePointerCancel}
        onPointerLeave={() =>
          setPointerPreview((prev) => (prev.visible ? { ...prev, visible: false } : prev))
        }
        onDoubleClick={(event) => {
          if (mode !== 'view') return;
          if (Date.now() - lastTouchDoubleTapAtRef.current < 450) return;
          if (event.target instanceof Element && event.target.closest('[data-lb-interactive="true"]')) {
            return;
          }
          animateZoomTo(viewTransformRef.current.scale > 1.15 ? 1 : 2.2, 0, 0);
        }}
        style={{ touchAction: 'none' }}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3 py-2 sm:px-8"
      >
        <div
          ref={stageRef}
          className="relative flex items-center justify-center"
        >
          <div
            ref={transformWrapRef}
            style={{
              transform: `translate3d(${viewTransform.tx}px, ${viewTransform.ty}px, 0) scale(${viewTransform.scale})`,
              transformOrigin: 'center center',
            }}
            className="relative will-change-transform"
          >
            <div
              ref={imageBoxRef}
              className={`relative inline-block leading-none ${
                mode === 'edit'
                  ? 'cursor-crosshair'
                  : isDrawingMode
                    ? 'cursor-none'
                    : viewTransform.scale > 1
                      ? 'cursor-grab active:cursor-grabbing'
                      : 'cursor-default'
              }`}
            >
              <NextImage
                src={image.src}
                alt={image.alt || 'Generated image'}
                width={naturalSize.width}
                height={naturalSize.height}
                unoptimized
                draggable={false}
                onLoad={(event) => {
                  const target = event.currentTarget;
                  if (target.naturalWidth > 0 && target.naturalHeight > 0) {
                    setNaturalSize({
                      width: target.naturalWidth,
                      height: target.naturalHeight,
                    });
                    setResizeRatio(getRatioFromDimensions(target.naturalWidth, target.naturalHeight));
                  }
                }}
                className={`block h-auto w-auto select-none rounded-2xl object-contain shadow-[0_24px_70px_rgba(0,0,0,0.65)] ${
                  mode === 'view'
                    ? 'max-h-[72dvh] max-w-[92vw] sm:max-h-[76dvh] sm:max-w-[82vw]'
                    : 'max-h-[52dvh] max-w-[90vw] sm:max-h-[62dvh] sm:max-w-[78vw]'
                }`}
              />

              {/* Drawing / Mask Overlay Canvas (Annotate & Remove) */}
              {(mode === 'annotate' || mode === 'remove') && (
                <canvas
                  ref={canvasRef}
                  data-gesture-ignore="true"
                  className="pointer-events-none absolute inset-0 h-full w-full rounded-2xl"
                />
              )}

              {/* Live Aspect Ratio Guide Overlay (Resize mode) */}
              {mode === 'resize' && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-black/30">
                  <div
                    ref={resizeGuideRef}
                    style={resizeGuideStyle}
                    className="relative flex items-end justify-end rounded-xl border-2 border-[#e28666] bg-transparent shadow-[0_0_0_9999px_rgba(12,11,10,0.38)]"
                  >
                    <span className="m-2 rounded-full bg-[#151412]/80 px-2 py-0.5 text-[11px] font-semibold text-[#f4eee6]">
                      {resizeRatio}
                    </span>
                  </div>
                </div>
              )}

              {/* Numbered Edit Pins Overlay */}
              {mode === 'edit' && (
                <div className="pointer-events-none absolute inset-0">
                  {pins.map((pin, idx) => {
                    const isActive = pin.id === activePinId;
                    const placeLeft = pin.x > 0.62;
                    const placeAbove = pin.y > 0.7;

                    return (
                      <div
                        key={pin.id}
                        style={{
                          left: `${pin.x * 100}%`,
                          top: `${pin.y * 100}%`,
                        }}
                        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
                      >
                        <button
                          type="button"
                          data-lb-interactive="true"
                          data-active={isActive ? 'true' : 'false'}
                          onClick={(event) => {
                            event.stopPropagation();
                            setActivePinId(isActive ? null : pin.id);
                          }}
                          aria-label={`Edit point ${idx + 1}${pin.note ? `: ${pin.note}` : ''}`}
                          className="dc-lb-pin-badge"
                        >
                          {idx + 1}
                        </button>

                        {/* Desktop Floating Callout beside Pin */}
                        {isActive && (
                          <div
                            data-lb-interactive="true"
                            onPointerDown={(e) => e.stopPropagation()}
                            className={`dc-lb-compact-composer absolute z-40 hidden w-60 rounded-2xl p-2.5 sm:block ${
                              placeLeft ? 'right-8' : 'left-8'
                            } ${placeAbove ? 'bottom-0' : 'top-0'}`}
                          >
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#e28666]">
                                Titik #{idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setPins((prev) => prev.filter((item) => item.id !== pin.id));
                                  setActivePinId(null);
                                }}
                                aria-label={`Delete pin ${idx + 1}`}
                                className="rounded-full p-1 text-[#f4eee6]/70 hover:bg-white/10 hover:text-white"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <input
                                ref={pinInputRef}
                                type="text"
                                value={pin.note}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPins((prev) =>
                                    prev.map((item) =>
                                      item.id === pin.id ? { ...item, note: val } : item
                                    )
                                  );
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    setActivePinId(null);
                                  }
                                }}
                                placeholder={`Ubah bagian #${idx + 1}...`}
                                className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#e28666]"
                              />
                              <button
                                type="button"
                                onClick={() => setActivePinId(null)}
                                className="rounded-xl bg-[#e28666] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#151412]"
                              >
                                OK
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Floating Brush Circle Preview */}
        {isDrawingMode && pointerPreview.visible && (
          <div
            aria-hidden="true"
            style={{
              left: pointerPreview.x,
              top: pointerPreview.y,
              width: cursorPreviewDiameter,
              height: cursorPreviewDiameter,
            }}
            className="pointer-events-none fixed z-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/90 bg-white/10 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
          />
        )}
      </div>

      {/* Bottom Floating Studio Dock */}
      <div
        ref={bottomBarRef}
        data-lb-interactive="true"
        className="relative z-30 flex w-full flex-col items-center gap-2 px-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-1 sm:px-6 sm:pb-6"
      >
        {/* Mode: VIEW — Primary Studio Mode Selector Toolbar */}
        {mode === 'view' && (
          <div
            ref={toolbarRef}
            role="toolbar"
            {...({ focusgroup: 'toolbar wrap' } as Record<string, string>)}
            aria-label="Image studio modes"
            className="dc-lb-glass dc-lb-toolbar-scroll flex max-w-full items-center gap-1 rounded-full p-1.5"
          >
            <button
              type="button"
              onClick={() => switchMode('edit')}
              className="dc-lb-btn shrink-0 px-3.5 text-[13px] font-medium"
            >
              <PenLine className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span>Edit</span>
            </button>

            <button
              type="button"
              onClick={() => switchMode('annotate')}
              className="dc-lb-btn shrink-0 px-3.5 text-[13px] font-medium"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
                <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
              </svg>
              <span>Anotasi</span>
            </button>

            <button
              type="button"
              onClick={() => switchMode('resize')}
              className="dc-lb-btn shrink-0 px-3.5 text-[13px] font-medium"
            >
              <Scan className="h-4 w-4 shrink-0" strokeWidth={2} />
              <span>Ubah ukuran</span>
            </button>

            <button
              type="button"
              onClick={() => switchMode('remove')}
              className="dc-lb-btn shrink-0 px-3.5 text-[13px] font-medium"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                <path d="M22 21H7" />
                <path d="m5 11 9 9" />
              </svg>
              <span>Hapus</span>
            </button>
          </div>
        )}

        {/* Mode: EDIT — Pin Editor (mobile safe) + Pin Chips + Compact Textarea */}
        {mode === 'edit' && (
          <div className="flex w-full max-w-[34rem] flex-col gap-2">
            {/* Mobile Inline Active Pin Description Editor (never obscured by virtual keyboard) */}
            {activePin && (
              <div className="dc-lb-compact-composer flex items-center gap-2 rounded-2xl px-3 py-2 sm:hidden">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e28666] text-[11.5px] font-bold text-[#151412]">
                  {activePinIndex + 1}
                </span>
                <input
                  ref={mobilePinInputRef}
                  type="text"
                  value={activePin.note}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPins((prev) =>
                      prev.map((item) =>
                        item.id === activePin.id ? { ...item, note: val } : item
                      )
                    );
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setActivePinId(null);
                    }
                  }}
                  placeholder={`Ubah titik #${activePinIndex + 1}...`}
                  className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setActivePinId(null)}
                  className="rounded-full bg-[#e28666] px-2.5 py-1 text-[11.5px] font-semibold text-[#151412]"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPins((prev) => prev.filter((item) => item.id !== activePin.id));
                    setActivePinId(null);
                  }}
                  aria-label={`Delete pin ${activePinIndex + 1}`}
                  className="dc-lb-btn h-8 w-8"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Pin Chips Strip */}
            {pins.length > 0 && (
              <div className="dc-lb-toolbar-scroll flex items-center gap-1.5 px-1">
                {pins.map((pin, idx) => (
                  <div
                    key={pin.id}
                    className={`dc-lb-glass inline-flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1.5 pr-2 text-[12px] ${
                      pin.id === activePinId ? 'border-[#e28666]/70' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActivePinId(pin.id)}
                      className="inline-flex items-center gap-1.5 text-left"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#e28666] text-[10.5px] font-bold text-[#151412]">
                        {idx + 1}
                      </span>
                      <span className="max-w-[9rem] truncate text-[#f4eee6]/90">
                        {pin.note.trim() || `Titik ${idx + 1}`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPins((prev) => prev.filter((item) => item.id !== pin.id));
                        if (activePinId === pin.id) setActivePinId(null);
                      }}
                      aria-label={`Remove pin ${idx + 1}`}
                      className="rounded-full p-0.5 text-[#f4eee6]/60 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Compact Textarea */}
            <div className="dc-lb-compact-composer flex items-end gap-2 px-3.5 py-2">
              <textarea
                ref={editTextareaRef}
                rows={1}
                value={editPrompt}
                onChange={(e) => {
                  setEditPrompt(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 88)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (canSendEdit && !isExporting && !isBusy) void submitStudioEdit();
                  }
                }}
                placeholder="Ketuk gambar untuk titik (1, 2…) atau tulis edit..."
                className="max-h-[88px] min-h-[34px] flex-1 resize-none bg-transparent py-1.5 text-[13.5px] leading-snug outline-none"
              />
              <button
                type="button"
                disabled={!canSendEdit || isExporting || isBusy}
                onClick={() => void submitStudioEdit()}
                aria-label="Kirim edit gambar"
                aria-busy={isExporting}
                className="dc-lb-send-btn"
              >
                {isExporting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-[17px] w-[17px]" strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Mode: ANNOTATE — Stage A (Drawing/Mask Dock) OR Stage B (Slide-up Compact Textarea) */}
        {mode === 'annotate' && annotateStage === 'drawing' && (
          <div className="dc-lb-glass dc-lb-toolbar-scroll flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1.5">
            {/* Tool Switcher */}
            <div
              ref={toolbarRef}
              role="toolbar"
              {...({ focusgroup: 'toolbar wrap' } as Record<string, string>)}
              aria-label="Annotation tools"
              className="flex items-center gap-1"
            >
              <button
                type="button"
                aria-pressed={annotateTool === 'draw'}
                onClick={() => setAnnotateTool('draw')}
                aria-label="Pensil coret"
                className="dc-lb-btn shrink-0 px-2.5 text-[12.5px] font-medium"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
                <span className="hidden sm:inline">Pensil</span>
              </button>

              <button
                type="button"
                aria-pressed={annotateTool === 'mask'}
                onClick={() => setAnnotateTool('mask')}
                aria-label="Mask area"
                className="dc-lb-btn shrink-0 px-2.5 text-[12.5px] font-medium"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
                  <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
                </svg>
                <span>Mask</span>
              </button>

              <button
                type="button"
                aria-pressed={annotateTool === 'erase'}
                onClick={() => setAnnotateTool('erase')}
                aria-label="Hapus coretan"
                className="dc-lb-btn shrink-0 px-2.5 text-[12.5px] font-medium"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                  <path d="M22 21H7" />
                </svg>
                <span className="hidden sm:inline">Hapus</span>
              </button>
            </div>

            <span className="h-5 w-px shrink-0 bg-white/15" aria-hidden="true" />

            {/* Brush Size Control */}
            <div className="flex shrink-0 items-center gap-1.5 px-1">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full bg-[#f4eee6]/70"
              />
              <input
                type="range"
                min={6}
                max={42}
                value={annotateBrushPx}
                onChange={(e) => setAnnotateBrushPx(Number(e.target.value))}
                aria-label="Ukuran pensil atau mask"
                className="dc-lb-range w-16 sm:w-20"
              />
              <span
                aria-hidden="true"
                className="inline-block h-3.5 w-3.5 rounded-full bg-[#f4eee6]/90"
              />
            </div>

            {/* Color Swatches (only when Pensil is active) */}
            {annotateTool === 'draw' && (
              <>
                <span className="h-5 w-px shrink-0 bg-white/15" aria-hidden="true" />
                <div className="flex shrink-0 items-center gap-1 px-0.5">
                  {ANNOTATE_COLORS.map((swatch) => {
                    const active = annotateColor === swatch.hex;
                    return (
                      <button
                        key={swatch.id}
                        type="button"
                        onClick={() => setAnnotateColor(swatch.hex)}
                        aria-label={swatch.label}
                        aria-pressed={active}
                        className={`h-6 w-6 rounded-full border transition-transform ${
                          active ? 'scale-110 border-white ring-2 ring-[#e28666]' : 'border-white/30'
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      />
                    );
                  })}
                </div>
              </>
            )}

            <span className="h-5 w-px shrink-0 bg-white/15" aria-hidden="true" />

            {/* Undo & Clear */}
            <button
              type="button"
              disabled={annotateStrokes.length === 0}
              onClick={() => setAnnotateStrokes((prev) => prev.slice(0, -1))}
              aria-label="Undo stroke"
              title="Undo"
              className="dc-lb-btn h-8 w-8 shrink-0"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
              </svg>
            </button>

            <button
              type="button"
              disabled={annotateStrokes.length === 0}
              onClick={() => setAnnotateStrokes([])}
              aria-label="Reset coretan"
              title="Reset"
              className="dc-lb-btn h-8 w-8 shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>

            {/* Done -> Reveals compact textarea from bottom to top */}
            <button
              type="button"
              onClick={() => {
                setAnnotateStage('prompt');
                setStatusAnnouncement('Masukkan deskripsi anotasi');
              }}
              className="ml-0.5 inline-flex h-8 shrink-0 items-center rounded-full bg-[#e28666] px-3.5 text-[12.5px] font-semibold text-[#151412] transition hover:bg-[#ea9678] active:scale-95"
            >
              Selesai
            </button>
          </div>
        )}

        {mode === 'annotate' && annotateStage === 'prompt' && (
          <div
            ref={annotatePromptWrapRef}
            className="dc-lb-compact-composer flex w-full max-w-[31rem] items-end gap-2 px-3 py-2"
          >
            <button
              type="button"
              onClick={() => setAnnotateStage('drawing')}
              aria-label="Kembali edit coretan"
              title="Edit coretan"
              className="dc-lb-btn h-8 w-8 shrink-0"
            >
              <PenLine className="h-4 w-4" strokeWidth={2.1} />
            </button>

            <textarea
              ref={annotateTextareaRef}
              rows={1}
              value={annotatePrompt}
              onChange={(e) => {
                setAnnotatePrompt(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 84)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (canSendAnnotate && !isExporting && !isBusy) void submitStudioEdit();
                }
              }}
              placeholder="Jelaskan maksud coretan atau mask ini..."
              className="max-h-[84px] min-h-[34px] flex-1 resize-none bg-transparent py-1.5 text-[13.5px] leading-snug outline-none"
            />

            <button
              type="button"
              disabled={!canSendAnnotate || isExporting || isBusy}
              onClick={() => void submitStudioEdit()}
              aria-label="Kirim edit anotasi"
              aria-busy={isExporting}
              className="dc-lb-send-btn"
            >
              {isExporting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-[17px] w-[17px]" strokeWidth={2.5} />
              )}
            </button>
          </div>
        )}

        {/* Mode: RESIZE — Compact Responsive Ratio Picker + Send */}
        {mode === 'resize' && (
          <div className="dc-lb-compact-composer flex w-full max-w-[34rem] flex-col gap-2 p-2.5">
            <div className="dc-lb-toolbar-scroll flex items-center gap-1.5">
              {RESIZE_RATIOS.map((opt) => {
                const active = resizeRatio === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setResizeRatio(opt.value)}
                    className="dc-lb-btn shrink-0 gap-1.5 px-3 text-[12px] font-semibold"
                  >
                    <span
                      aria-hidden="true"
                      style={{ width: opt.w, height: opt.h }}
                      className="inline-block rounded-[2px] border-[1.5px] border-current"
                    />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 border-t border-white/10 pt-1.5 pl-1.5">
              <input
                type="text"
                value={resizeNote}
                onChange={(e) => setResizeNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!isExporting && !isBusy) void submitStudioEdit();
                  }
                }}
                placeholder="Catatan opsional (mis. perluas latar alami)..."
                className="min-w-0 flex-1 bg-transparent py-1 text-[13px] outline-none"
              />
              <button
                type="button"
                disabled={isExporting || isBusy}
                onClick={() => void submitStudioEdit()}
                aria-label={`Ubah ukuran ke ${resizeRatio}`}
                aria-busy={isExporting}
                className="dc-lb-send-btn"
              >
                {isExporting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-[17px] w-[17px]" strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Mode: REMOVE — Minimalist: ONLY Mask Size (small/large) + Send */}
        {mode === 'remove' && (
          <div className="dc-lb-glass flex items-center gap-2 rounded-full px-3 py-1.5">
            <button
              type="button"
              onClick={() => setRemoveBrushPx((prev) => clamp(prev - 8, 10, 68))}
              aria-label="Perkecil ukuran mask"
              className="dc-lb-btn h-8 w-8 shrink-0"
            >
              <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-current" aria-hidden="true" />
            </button>

            <input
              type="range"
              min={10}
              max={68}
              value={removeBrushPx}
              onChange={(e) => setRemoveBrushPx(Number(e.target.value))}
              aria-label="Ukuran mask hapus"
              className="dc-lb-range w-24 sm:w-32"
            />

            <button
              type="button"
              onClick={() => setRemoveBrushPx((prev) => clamp(prev + 8, 10, 68))}
              aria-label="Perbesar ukuran mask"
              className="dc-lb-btn h-8 w-8 shrink-0"
            >
              <span className="inline-block h-4.5 w-4.5 rounded-full border-2 border-current" aria-hidden="true" />
            </button>

            {removeStrokes.length > 0 && (
              <button
                type="button"
                onClick={() => setRemoveStrokes((prev) => prev.slice(0, -1))}
                aria-label="Undo mask terakhir"
                className="dc-lb-btn h-8 w-8 shrink-0"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 14 4 9l5-5" />
                  <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
                </svg>
              </button>
            )}

            <button
              type="button"
              disabled={!canSendRemove || isExporting || isBusy}
              onClick={() => void submitStudioEdit()}
              aria-label="Kirim hapus objek"
              aria-busy={isExporting}
              className="dc-lb-send-btn ml-1"
            >
              {isExporting ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-[17px] w-[17px]" strokeWidth={2.5} />
              )}
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
