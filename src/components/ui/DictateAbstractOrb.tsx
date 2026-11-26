'use client';

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface DictateAbstractOrbProps {
  isDictating: boolean;
  activityTick?: number;
  mediaStream?: MediaStream | null;
  className?: string;
}

const IDLE_HEIGHTS = [6, 11, 16, 11, 6];
const BAR_X = [3.5, 7.5, 11.5, 15.5, 19.5];

export default function DictateAbstractOrb({
  isDictating,
  activityTick = 0,
  mediaStream = null,
  className = 'h-5 w-5',
}: DictateAbstractOrbProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const haloRef = useRef<SVGCircleElement | null>(null);
  const barRefs = useRef<Array<SVGRectElement | null>>([]);
  const phaseRef = useRef(0);
  const energyRef = useRef(0.35);

  // Crank up the wave energy whenever actual speech results roll in
  useEffect(() => {
    if (!isDictating || activityTick <= 0) return;
    energyRef.current = 1;
  }, [activityTick, isDictating]);

  // GSAP transition between idle and dictating states
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
      energyRef.current = 0.65;
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
      energyRef.current = 0;
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

  // Continuous GSAP ticker for voice-reactive bars (reuses existing mediaStream so it doesn't hijack the mic)
  useEffect(() => {
    if (!isDictating) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let freqData: Uint8Array<ArrayBuffer> | null = null;

    if (mediaStream) {
      try {
        const AudioContextCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextCtor) {
          audioCtx = new AudioContextCtor();
          const source = audioCtx.createMediaStreamSource(mediaStream);
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.72;
          source.connect(analyser);
          freqData = new Uint8Array(analyser.frequencyBinCount);
        }
      } catch {
        analyser = null;
      }
    }

    const quickHeights = barRefs.current.map(bar =>
      bar ? gsap.quickTo(bar, 'attr:height', { duration: 0.09, ease: 'power2.out' }) : null
    );
    const quickYs = barRefs.current.map(bar =>
      bar ? gsap.quickTo(bar, 'attr:y', { duration: 0.09, ease: 'power2.out' }) : null
    );
    const quickHaloScale = haloRef.current
      ? gsap.quickTo(haloRef.current, 'scale', { duration: 0.14, ease: 'power2.out' })
      : null;

    const tick = (_time: number, deltaMs: number) => {
      const dt = Math.min(deltaMs, 48);
      phaseRef.current += dt * 0.009;

      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
        const binIndices = [1, 3, 5, 8, 11];
        let rms = 0;
        for (let i = 0; i < 5; i += 1) {
          const val = (freqData[binIndices[i]] || 0) / 255;
          rms += val;
          const ambient = Math.sin(phaseRef.current + i * 0.85) * 1.1;
          const targetH = Math.max(4.5, Math.min(18.5, 5.5 + val * 13.5 + ambient));
          quickHeights[i]?.(targetH);
          quickYs[i]?.(12 - targetH * 0.5);
        }
        rms /= 5;
        quickHaloScale?.(0.96 + rms * 0.44);
        return;
      }

      // Bleed the speech spike back down to the chill baseline
      energyRef.current = Math.max(0.32, energyRef.current - dt * 0.0012);
      const energy = energyRef.current;
      for (let i = 0; i < 5; i += 1) {
        const waveA = Math.sin(phaseRef.current * 1.2 + i * 0.95);
        const waveB = Math.cos(phaseRef.current * 0.75 - i * 0.65);
        const norm = (waveA * 0.65 + waveB * 0.35) * 0.5 + 0.5;
        const targetH = Math.max(4.5, Math.min(18.5, 5 + norm * (7 + energy * 7)));
        quickHeights[i]?.(targetH);
        quickYs[i]?.(12 - targetH * 0.5);
      }

      quickHaloScale?.(0.96 + energy * 0.36);
    };

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      if (audioCtx && audioCtx.state !== 'closed') {
        void audioCtx.close().catch(() => undefined);
      }
    };
  }, [isDictating, mediaStream]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`${className} overflow-visible`}
    >
      <circle
        ref={haloRef}
        cx="12"
        cy="12"
        r="11"
        fill={isDictating ? '#3b82f6' : 'currentColor'}
        opacity={0}
      />

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
