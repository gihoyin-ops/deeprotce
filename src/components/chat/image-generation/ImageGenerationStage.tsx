'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import NextImage from 'next/image';
import { gsap } from 'gsap';
import { Download, Maximize2 } from '@/components/ui/icons';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import { type ExtractedGeneratedImage } from '@/lib/images/image-generation';
import { type ImageAspectRatio } from '@/lib/images/image-aspect-ratio';
import AbstractStudioCanvas from './AbstractStudioCanvas';
import ZenSnakeCanvas from './ZenSnakeCanvas';

export type ImageGenerationVisualMode = 'abstract-text' | 'abstract-pure' | 'zen-snake';

export const IMAGE_GEN_SNAKE_PROBABILITY = 0.0000001; // 0.00001%
export const IMAGE_GEN_ABSTRACT_TEXT_PROBABILITY = 0.95; // 95% (remainder ~5% -> abstract-pure)

export interface ImageGenerationStageProps {
  isGenerating: boolean;
  images: ExtractedGeneratedImage[];
  requestedAspectRatio?: ImageAspectRatio;
  onPreviewImage?: (image: ExtractedGeneratedImage, index: number) => void;
}

interface BoxSize {
  width: number;
  height: number;
}

interface MorphBoxes {
  from: BoxSize;
  to: BoxSize;
}

function getHighPrecisionRandom(): number {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const words = new Uint32Array(2);
    window.crypto.getRandomValues(words);
    const high = words[0] >>> 5; // 27 bits
    const low = words[1] >>> 6; // 26 bits
    return (high * 67108864 + low) / 9007199254740992; // 2^53
  }
  return Math.random();
}

export function pickImageGenerationVisualMode(): ImageGenerationVisualMode {
  const r = getHighPrecisionRandom();
  if (r < IMAGE_GEN_SNAKE_PROBABILITY) return 'zen-snake';
  if (r < IMAGE_GEN_SNAKE_PROBABILITY + IMAGE_GEN_ABSTRACT_TEXT_PROBABILITY) {
    return 'abstract-text';
  }
  return 'abstract-pure';
}

function createCubicBezierEase(x1: number, y1: number, x2: number, y2: number) {
  const sampleCurveX = (t: number) =>
    ((1 - 3 * x2 + 3 * x1) * t + (3 * x2 - 6 * x1)) * t * t + 3 * x1 * t;
  const sampleCurveY = (t: number) =>
    ((1 - 3 * y2 + 3 * y1) * t + (3 * y2 - 6 * y1)) * t * t + 3 * y1 * t;
  const sampleDerivativeX = (t: number) =>
    (3 * (1 - 3 * x2 + 3 * x1) * t + 2 * (3 * x2 - 6 * x1)) * t + 3 * x1;

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    let t = x;
    for (let i = 0; i < 6; i += 1) {
      const err = sampleCurveX(t) - x;
      if (Math.abs(err) < 1e-5) return sampleCurveY(t);
      const deriv = sampleDerivativeX(t);
      if (Math.abs(deriv) < 1e-6) break;
      t -= err / deriv;
    }

    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 12; i += 1) {
      const val = sampleCurveX(t);
      if (Math.abs(val - x) < 1e-5) break;
      if (x > val) lo = t;
      else hi = t;
      t = 0.5 * (lo + hi);
    }
    return sampleCurveY(t);
  };
}

const anthropicMorphEase = createCubicBezierEase(0.24, 0.04, 0.16, 1);

function getRequestedRatioNumeric(aspectRatio?: ImageAspectRatio): number {
  switch (aspectRatio) {
    case '16:9':
      return 16 / 9;
    case '4:3':
      return 4 / 3;
    case '1:1':
      return 1;
    case '3:4':
      return 3 / 4;
    case '9:16':
      return 9 / 16;
    default:
      return 4 / 3;
  }
}

function computeStageDimensions(
  ratio: number,
  availableWidth: number,
  viewportHeight: number,
  mode: 'waiting' | 'final'
): BoxSize {
  const safeW = Math.max(200, availableWidth);
  const safeVH = Math.max(420, viewportHeight);
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? Math.min(Math.max(ratio, 0.35), 2.8) : 4 / 3;

  if (mode === 'waiting') {
    const targetArea = 114000;
    const minW = Math.min(248, safeW);
    const maxW = Math.min(safeW, 450);
    const minH = 220;
    const maxH = Math.min(Math.round(safeVH * 0.52), 400);

    const w = Math.min(Math.max(Math.sqrt(targetArea * safeRatio), minW), maxW);
    const h = Math.min(Math.max(w / safeRatio, minH), maxH);
    return {
      width: Math.round(w),
      height: Math.round(h),
    };
  }

  const targetArea = 188000;
  const maxW = Math.min(safeW, safeRatio > 1.25 ? 620 : safeRatio < 0.85 ? 420 : 480);
  const maxH = Math.min(Math.round(safeVH * 0.68), 580);
  const minW = Math.min(safeW, 240);

  let w = Math.sqrt(targetArea * safeRatio);
  let h = w / safeRatio;

  if (w > maxW) {
    w = maxW;
    h = w / safeRatio;
  }
  if (h > maxH) {
    h = maxH;
    w = h * safeRatio;
  }
  if (w < minW && minW / safeRatio <= maxH) {
    w = minW;
    h = w / safeRatio;
  }

  return {
    width: Math.round(w),
    height: Math.round(h),
  };
}

function getExtensionFromImageSrc(src: string): string {
  const dataMatch = src.match(/^data:image\/([a-z0-9.+-]+)/i);
  if (dataMatch) {
    return dataMatch[1].toLowerCase().replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  }
  const pathMatch = src.split('?')[0]?.match(/\.([a-z0-9]+)$/i);
  if (pathMatch) {
    return pathMatch[1].toLowerCase();
  }
  return 'png';
}

async function downloadGeneratedImage(src: string, index: number) {
  const ext = getExtensionFromImageSrc(src);
  const filename = `deepchat-image-${index + 1}.${ext}`;

  if (src.startsWith('data:')) {
    try {
      const commaIdx = src.indexOf(',');
      const header = src.slice(0, commaIdx);
      const body = src.slice(commaIdx + 1);
      const mimeMatch = header.match(/^data:([^;]+)/i);
      const mime = mimeMatch?.[1] || 'image/png';
      const binary = atob(body);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1200);
      return;
    } catch {
      // Fall through to direct link download if base64 decoding fails
    }
  }

  const link = document.createElement('a');
  link.href = src;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export default function ImageGenerationStage({
  isGenerating,
  images,
  requestedAspectRatio = 'auto',
  onPreviewImage,
}: ImageGenerationStageProps) {
  const primaryImage = images[0] || null;
  const secondaryImages = images.slice(1);

  const outerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const waitingLayerRef = useRef<HTMLDivElement>(null);
  const imageLayerRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);

  const [visualMode] = useState<ImageGenerationVisualMode>(pickImageGenerationVisualMode);
  const [phase, setPhase] = useState<'generating' | 'morphing' | 'settled'>(() =>
    images.length > 0 && !isGenerating ? 'settled' : 'generating'
  );
  const [bounds, setBounds] = useState<{ width: number; height: number }>({
    width: 640,
    height: 800,
  });
  const [decodedSize, setDecodedSize] = useState<{ width: number; height: number } | null>(null);
  const [morphBoxes, setMorphBoxes] = useState<MorphBoxes | null>(null);
  const [settledLoadedSrc, setSettledLoadedSrc] = useState<string | null>(null);

  const entrancePlayedRef = useRef(false);

  // Measure available container width & viewport height asynchronously (ResizeObserver + rAF)
  useEffect(() => {
    const outerEl = outerRef.current;
    if (!outerEl) return;

    const measure = () => {
      const nextWidth = Math.round(outerEl.clientWidth || 640);
      const nextHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
      setBounds((prev) =>
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight }
      );
    };

    const rafId = window.requestAnimationFrame(measure);
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => window.requestAnimationFrame(measure))
        : null;
    observer?.observe(outerEl);
    window.addEventListener('resize', measure);

    return () => {
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Gentle studio stage entrance when entering in 'generating' mode
  useEffect(() => {
    if (phase !== 'generating' || entrancePlayedRef.current) return;
    const frameEl = frameRef.current;
    if (!frameEl) return;

    entrancePlayedRef.current = true;
    const reduce = prefersReducedMotion();

    gsap.fromTo(
      frameEl,
      {
        opacity: 0,
        y: reduce ? 0 : 12,
        scale: reduce ? 1 : 0.975,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: reduce ? 0.18 : 0.56,
        ease: 'expo.out',
        clearProps: 'transform,opacity',
      }
    );
  }, [phase]);

  // Preload & decode the primary generated image offscreen before launching aspect-ratio morph
  useEffect(() => {
    if (phase !== 'generating' || !primaryImage?.src) return;

    let cancelled = false;
    const loader = new window.Image();
    loader.decoding = 'async';

    const startMorphWithSize = (natW: number, natH: number) => {
      if (cancelled) return;
      const frameEl = frameRef.current;
      const outerEl = outerRef.current;
      const rect = frameEl?.getBoundingClientRect();
      const availW = Math.round(outerEl?.clientWidth || bounds.width || 640);
      const vpH = typeof window !== 'undefined' ? window.innerHeight : bounds.height;

      const fallbackWaiting = computeStageDimensions(
        getRequestedRatioNumeric(requestedAspectRatio),
        availW,
        vpH,
        'waiting'
      );
      const startBox: BoxSize = {
        width: Math.max(160, Math.round(rect?.width || fallbackWaiting.width)),
        height: Math.max(160, Math.round(rect?.height || fallbackWaiting.height)),
      };
      const targetBox = computeStageDimensions(natW / natH, availW, vpH, 'final');

      setDecodedSize({ width: natW, height: natH });
      setMorphBoxes({ from: startBox, to: targetBox });
      setPhase('morphing');
    };

    loader.onload = () => {
      const natW = loader.naturalWidth || 1024;
      const natH = loader.naturalHeight || 1024;
      if (typeof loader.decode === 'function') {
        void loader
          .decode()
          .catch(() => undefined)
          .then(() => startMorphWithSize(natW, natH));
      } else {
        startMorphWithSize(natW, natH);
      }
    };

    loader.onerror = () => {
      startMorphWithSize(1024, 1024);
    };

    loader.src = primaryImage.src;

    return () => {
      cancelled = true;
    };
  }, [phase, primaryImage?.src, bounds.width, bounds.height, requestedAspectRatio]);

  // Execute silky-smooth GSAP aspect-ratio expansion & photographic unveil
  useLayoutEffect(() => {
    if (phase !== 'morphing' || !morphBoxes) return;
    const frameEl = frameRef.current;
    const waitingEl = waitingLayerRef.current;
    const imageEl = imageLayerRef.current;
    const sheenEl = sheenRef.current;
    if (!frameEl || !imageEl) return;

    const reduce = prefersReducedMotion();
    const { from, to } = morphBoxes;

    gsap.killTweensOf([frameEl, waitingEl, imageEl, sheenEl].filter(Boolean));
    gsap.set(frameEl, {
      width: from.width,
      height: from.height,
      aspectRatio: 'auto',
    });

    const tl = gsap.timeline({
      onComplete: () => {
        setPhase('settled');
      },
    });

    if (reduce) {
      gsap.set(frameEl, { width: to.width, height: to.height });
      if (waitingEl) {
        tl.to(waitingEl, { opacity: 0, duration: 0.16, ease: 'power1.out' }, 0);
      }
      tl.fromTo(
        imageEl,
        { opacity: 0 },
        { opacity: 1, duration: 0.22, ease: 'power1.out' },
        0.04
      );
      return () => {
        tl.kill();
      };
    }

    if (waitingEl) {
      tl.to(
        waitingEl,
        {
          opacity: 0,
          scale: 0.985,
          filter: 'blur(6px)',
          duration: 0.36,
          ease: 'power2.inOut',
        },
        0
      );
    }

    tl.to(
      frameEl,
      {
        width: to.width,
        height: to.height,
        duration: 0.84,
        ease: anthropicMorphEase,
      },
      0.06
    );

    if (sheenEl) {
      tl.fromTo(
        sheenEl,
        { xPercent: -115, opacity: 0 },
        {
          xPercent: 120,
          opacity: 0.72,
          duration: 0.68,
          ease: 'power2.inOut',
          onComplete: () => {
            gsap.set(sheenEl, { opacity: 0 });
          },
        },
        0.14
      );
    }

    tl.fromTo(
      imageEl,
      {
        opacity: 0,
        scale: 1.045,
        filter: 'blur(14px) saturate(0.86)',
      },
      {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px) saturate(1)',
        duration: 0.74,
        ease: 'power2.out',
        clearProps: 'transform,filter',
      },
      0.24
    );

    return () => {
      tl.kill();
    };
  }, [phase, morphBoxes]);

  // Clear inline pixel height once settled so CSS aspectRatio + min(100%, width) stays responsive
  useLayoutEffect(() => {
    if (phase !== 'settled') return;
    const frameEl = frameRef.current;
    if (!frameEl) return;
    frameEl.style.removeProperty('height');
    frameEl.style.removeProperty('transform');
    if (imageLayerRef.current) {
      imageLayerRef.current.style.removeProperty('filter');
    }
  }, [phase]);

  const requestedRatio = getRequestedRatioNumeric(requestedAspectRatio);
  const waitingBox = computeStageDimensions(
    requestedRatio,
    bounds.width,
    bounds.height,
    'waiting'
  );
  const resolvedRatio = decodedSize
    ? decodedSize.width / decodedSize.height
    : requestedRatio;
  const finalBox = computeStageDimensions(
    resolvedRatio,
    bounds.width,
    bounds.height,
    'final'
  );

  const frameStyle: React.CSSProperties | undefined =
    phase === 'generating'
      ? {
          width: `${waitingBox.width}px`,
          maxWidth: '100%',
          aspectRatio: `${waitingBox.width} / ${waitingBox.height}`,
        }
      : phase === 'settled'
        ? {
            width: `${finalBox.width}px`,
            maxWidth: '100%',
            aspectRatio: decodedSize
              ? `${decodedSize.width} / ${decodedSize.height}`
              : `${Math.round(requestedRatio * 100)} / 100`,
          }
        : undefined;

  const isSettledImageVisible =
    phase === 'morphing' ||
    (phase === 'settled' &&
      (Boolean(morphBoxes) || (Boolean(primaryImage) && settledLoadedSrc === primaryImage?.src)));

  return (
    <div ref={outerRef} className="dc-img-studio w-full max-w-full">
      <div
        ref={frameRef}
        style={frameStyle}
        className="dc-img-studio-frame dc-img-studio-card"
      >
        {/* Waiting / Loading Studio Canvas (unmounts completely once settled) */}
        {phase !== 'settled' && (
          <div
            ref={waitingLayerRef}
            className="absolute inset-0 z-10 h-full w-full"
          >
            {visualMode === 'zen-snake' ? (
              <ZenSnakeCanvas isExiting={phase === 'morphing'} />
            ) : (
              <AbstractStudioCanvas
                variant={visualMode}
                requestedAspectRatio={requestedAspectRatio}
                isExiting={phase === 'morphing'}
              />
            )}
          </div>
        )}

        {/* Warm photographic sheen swept across during the morph unveil */}
        {phase === 'morphing' && (
          <div
            ref={sheenRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[65%] opacity-0"
            style={{ background: 'var(--dc-studio-sheen)' }}
          />
        )}

        {/* Primary Generated Image Layer */}
        {primaryImage && (
          <div
            ref={imageLayerRef}
            className={`relative h-full w-full transition-opacity duration-300 ${
              phase === 'settled' && !isSettledImageVisible ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <button
              type="button"
              onClick={() => onPreviewImage?.(primaryImage, 0)}
              aria-label={`Expand ${primaryImage.alt || 'generated image'}`}
              className="relative block h-full w-full cursor-zoom-in border-0 bg-transparent p-0 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--dc-studio-clay)]"
            >
              <NextImage
                src={primaryImage.src}
                alt={primaryImage.alt || 'Generated image'}
                fill
                unoptimized
                sizes="(max-width: 640px) 94vw, 620px"
                className="object-cover"
                onLoad={(event) => {
                  const img = event.currentTarget;
                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    setDecodedSize((prev) =>
                      prev &&
                      prev.width === img.naturalWidth &&
                      prev.height === img.naturalHeight
                        ? prev
                        : { width: img.naturalWidth, height: img.naturalHeight }
                    );
                  }
                  setSettledLoadedSrc(primaryImage.src);
                }}
              />
            </button>

            {phase === 'settled' && (
              <div className="dc-img-studio-actions pointer-events-auto absolute right-2.5 top-2.5 z-20 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void downloadGeneratedImage(primaryImage.src, 0)}
                  aria-label="Download generated image"
                  title="Download image"
                  className="dc-img-studio-pill inline-flex h-8 w-8 items-center justify-center rounded-full shadow-sm active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={() => onPreviewImage?.(primaryImage, 0)}
                  aria-label="Preview full size"
                  title="Expand image"
                  className="dc-img-studio-pill inline-flex h-8 w-8 items-center justify-center rounded-full shadow-sm active:scale-95"
                >
                  <Maximize2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Additional images when a provider returns multiple variations */}
      {phase === 'settled' && secondaryImages.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {secondaryImages.map((img, idx) => (
            <SecondaryGeneratedImageCard
              key={`${img.src.slice(0, 48)}-${idx}`}
              image={img}
              index={idx + 1}
              onPreview={() => onPreviewImage?.(img, idx + 1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SecondaryGeneratedImageCard({
  image,
  index,
  onPreview,
}: {
  image: ExtractedGeneratedImage;
  index: number;
  onPreview: () => void;
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      className="dc-img-studio-frame dc-img-studio-card relative w-full"
      style={{
        aspectRatio: size ? `${size.width} / ${size.height}` : '4 / 3',
      }}
    >
      <button
        type="button"
        onClick={onPreview}
        aria-label={`Expand ${image.alt || `generated image ${index + 1}`}`}
        className={`relative block h-full w-full cursor-zoom-in border-0 bg-transparent p-0 text-left transition-opacity duration-300 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--dc-studio-clay)] ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <NextImage
          src={image.src}
          alt={image.alt || `Generated image ${index + 1}`}
          fill
          unoptimized
          sizes="(max-width: 640px) 94vw, 320px"
          className="object-cover"
          onLoad={(event) => {
            const target = event.currentTarget;
            if (target.naturalWidth > 0 && target.naturalHeight > 0) {
              setSize({ width: target.naturalWidth, height: target.naturalHeight });
            }
            setLoaded(true);
          }}
        />
      </button>

      <div className="dc-img-studio-actions pointer-events-auto absolute right-2 top-2 z-20 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => void downloadGeneratedImage(image.src, index)}
          aria-label={`Download generated image ${index + 1}`}
          title="Download image"
          className="dc-img-studio-pill inline-flex h-8 w-8 items-center justify-center rounded-full shadow-sm active:scale-95"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={onPreview}
          aria-label={`Preview generated image ${index + 1}`}
          title="Expand image"
          className="dc-img-studio-pill inline-flex h-8 w-8 items-center justify-center rounded-full shadow-sm active:scale-95"
        >
          <Maximize2 className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
