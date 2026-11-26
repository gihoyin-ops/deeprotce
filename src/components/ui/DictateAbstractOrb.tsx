'use client';

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface DictateAbstractOrbProps {
  isDictating: boolean;
  className?: string;
}

const IDLE_HEIGHTS = [6, 11, 16, 11, 6];
const BAR_X = [3.5, 7.5, 11.5, 15.5, 19.5];

export default function DictateAbstractOrb({
  isDictating,
  className = 'h-5 w-5',
}: DictateAbstractOrbProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const haloRef = useRef<SVGCircleElement | null>(null);
  const barRefs = useRef<Array<SVGRectElement | null>>([]);
  const phaseRef = useRef(0);

  // Smooth GSAP state transition (idle <-> dictating)
  useLayoutEffect(() => {
    const svgEl = svgRef.current;
    const haloEl = haloRef.current;
    if (!svgEl) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      if (haloEl) gsap.set(haloEl, { opacity: isDictating ? 0.25 : 0, scale: 1 });
      return;
    }

    gsap.killTweensOf([svgEl, haloEl].filter(Boolean));

    if (isDictating) {
      gsap.fromTo(
        svgEl,
        { scale: 0.86 },
        { scale: 1.06, duration: 0.36, ease: 'back.out(1.8)', force3D: true }
      );
      if (haloEl) {
        gsap.to(haloEl, {
          opacity: 0.28,
          scale: 1.12,
          transformOrigin: '50% 50%',
          duration: 0.35,
          ease: 'expo.out',
        });
      }
    } else {
      gsap.to(svgEl, {
        scale: 1,
        duration: 0.32,
        ease: 'expo.out',
        clearProps: 'transform',
        force3D: true,
      });
      if (haloEl) {
        gsap.to(haloEl, {
          opacity: 0,
          scale: 0.85,
          transformOrigin: '50% 50%',
          duration: 0.26,
          ease: 'power2.out',
        });
      }
      barRefs.current.forEach((bar, idx) => {
        if (!bar) return;
        const h = IDLE_HEIGHTS[idx];
        gsap.to(bar, {
          attr: { height: h, y: 12 - h * 0.5 },
          duration: 0.34,
          ease: 'expo.out',
        });
      });
    }
  }, [isDictating]);

  // Real-time Web Audio API voice-reactive GSAP morphing while dictating
  useEffect(() => {
    if (!isDictating) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let freqData: Uint8Array<ArrayBuffer> | null = null;

    const quickHeights = barRefs.current.map(bar =>
      bar ? gsap.quickTo(bar, 'attr:height', { duration: 0.08, ease: 'power2.out' }) : null
    );
    const quickYs = barRefs.current.map(bar =>
      bar ? gsap.quickTo(bar, 'attr:y', { duration: 0.08, ease: 'power2.out' }) : null
    );
    const quickHaloScale = haloRef.current
      ? gsap.quickTo(haloRef.current, 'scale', { duration: 0.1, ease: 'power2.out' })
      : null;

    const setupAudio = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        const AudioContextCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;
        audioCtx = new AudioContextCtor();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.72;
        source.connect(analyser);
        freqData = new Uint8Array(analyser.frequencyBinCount);
      } catch {
        // Fallback to organic harmonic pulse if mic stream is unavailable
      }
    };

    void setupAudio();

    const tick = (_time: number, deltaMs: number) => {
      phaseRef.current += Math.min(deltaMs, 48) * 0.0085;
      let rms = 0;

      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
        const binIndices = [1, 3, 5, 8, 11];
        for (let i = 0; i < 5; i += 1) {
          const val = (freqData[binIndices[i]] || 0) / 255;
          rms += val;
          const ambient = Math.sin(phaseRef.current + i * 0.85) * 1.1;
          const targetH = Math.max(4.5, Math.min(18, 5.5 + val * 13.5 + ambient));
          quickHeights[i]?.(targetH);
          quickYs[i]?.(12 - targetH * 0.5);
        }
        rms /= 5;
      } else {
        for (let i = 0; i < 5; i += 1) {
          const wave = Math.sin(phaseRef.current * 1.15 + i * 0.9) * 0.5 + 0.5;
          const targetH = 5 + wave * 11;
          rms += wave * 0.4;
          quickHeights[i]?.(targetH);
          quickYs[i]?.(12 - targetH * 0.5);
        }
        rms /= 5;
      }

      quickHaloScale?.(0.95 + rms * 0.45);
    };

    gsap.ticker.add(tick);

    return () => {
      cancelled = true;
      gsap.ticker.remove(tick);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        void audioCtx.close().catch(() => undefined);
      }
    };
  }, [isDictating]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`${className} overflow-visible`}
    >
      {/* Subtle reactive blue aura while dictating */}
      <circle
        ref={haloRef}
        cx="12"
        cy="12"
        r="11"
        fill={isDictating ? '#3b82f6' : 'currentColor'}
        opacity={0}
      />

      {/* Abstract 5-bar harmonic voice waveform */}
      {BAR_X.map((x, idx) => {
        const h = IDLE_HEIGHTS[idx];
        return (
          <rect
            key={x}
            ref={el => {
              barRefs.current[idx] = el;
            }}
            x={x}
            y={12 - h * 0.5}
            width="2"
            height={h}
            rx="1"
            fill={isDictating ? '#2563eb' : 'currentColor'}
            className="transition-colors duration-200"
          />
        );
      })}
    </svg>
  );
}
