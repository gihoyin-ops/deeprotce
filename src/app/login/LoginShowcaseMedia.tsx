'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Play } from '@/components/ui/icons';

const SHOWCASE_PROMPTS = [
  {
    tag: 'Reasoning',
    prompt: 'Analyze this distributed cache race condition and propose a lock-free fix.',
    accent: 'from-indigo-500/20 to-sky-500/10',
  },
  {
    tag: 'GPT Image 2.6',
    prompt: 'Render a minimalist editorial studio scene with soft volumetric daylight.',
    accent: 'from-violet-500/20 to-fuchsia-500/10',
  },
  {
    tag: 'Deep Research',
    prompt: 'Compare WebGPU vs WebGL2 compute throughput across modern browsers.',
    accent: 'from-emerald-500/20 to-teal-500/10',
  },
];

export default function LoginShowcaseMedia() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activePromptIndex, setActivePromptIndex] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      setActivePromptIndex((prev) => (prev + 1) % SHOWCASE_PROMPTS.length);
    }, 4200);
    return () => window.clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.documentElement.dataset.reduceMotion === 'on');

    let animationFrameId = 0;
    let width = 0;
    let height = 0;
    let time = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 34 }, (_, i) => ({
      angle: (i / 34) * Math.PI * 2,
      radius: 0.18 + (i % 7) * 0.055,
      speed: 0.002 + (i % 5) * 0.0008,
      size: 1.4 + (i % 3) * 0.9,
      alpha: 0.25 + (i % 4) * 0.15,
    }));

    const renderFrame = () => {
      const isDark = document.documentElement.classList.contains('dark');
      ctx.clearRect(0, 0, width, height);

      // Deep atmospheric backdrop
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      if (isDark) {
        bgGrad.addColorStop(0, '#090d16');
        bgGrad.addColorStop(0.55, '#111827');
        bgGrad.addColorStop(1, '#14192d');
      } else {
        bgGrad.addColorStop(0, '#0f172a');
        bgGrad.addColorStop(0.55, '#1e1b4b');
        bgGrad.addColorStop(1, '#0f172a');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const cx = width * 0.5;
      const cy = height * 0.44;
      const baseRadius = Math.min(width, height) * 0.32;

      // Ambient glowing nebulae
      const orb1X = cx + Math.cos(time * 0.6) * (width * 0.12);
      const orb1Y = cy + Math.sin(time * 0.45) * (height * 0.08);
      const glow1 = ctx.createRadialGradient(orb1X, orb1Y, 0, orb1X, orb1Y, baseRadius * 1.6);
      glow1.addColorStop(0, 'rgba(99, 102, 241, 0.42)');
      glow1.addColorStop(0.5, 'rgba(56, 189, 248, 0.16)');
      glow1.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = glow1;
      ctx.fillRect(0, 0, width, height);

      const orb2X = cx - Math.sin(time * 0.5) * (width * 0.14);
      const orb2Y = cy + Math.cos(time * 0.38) * (height * 0.1);
      const glow2 = ctx.createRadialGradient(orb2X, orb2Y, 0, orb2X, orb2Y, baseRadius * 1.35);
      glow2.addColorStop(0, 'rgba(168, 85, 247, 0.34)');
      glow2.addColorStop(0.55, 'rgba(79, 70, 229, 0.12)');
      glow2.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = glow2;
      ctx.fillRect(0, 0, width, height);

      // Flowing harmonic ribbons
      for (let r = 0; r < 3; r++) {
        ctx.beginPath();
        const phase = time * (0.8 + r * 0.25) + r * 1.6;
        for (let x = 0; x <= width; x += 12) {
          const norm = x / Math.max(1, width);
          const y =
            cy +
            Math.sin(norm * 5 + phase) * (24 + r * 10) +
            Math.cos(norm * 3 - phase * 0.7) * 14;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle =
          r === 0
            ? 'rgba(129, 140, 248, 0.36)'
            : r === 1
              ? 'rgba(56, 189, 248, 0.24)'
              : 'rgba(192, 132, 252, 0.22)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      // Orbital rings
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time * 0.12);
      ctx.beginPath();
      ctx.ellipse(0, 0, baseRadius * 1.15, baseRadius * 0.48, 0.35, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, 0, baseRadius * 0.9, baseRadius * 0.9, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(165, 180, 252, 0.14)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Orbiting particles
      for (const p of particles) {
        const currentAngle = p.angle + time * p.speed * 60;
        const px = cx + Math.cos(currentAngle) * (Math.min(width, height) * p.radius);
        const py = cy + Math.sin(currentAngle * 1.15) * (Math.min(width, height) * p.radius * 0.72);
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(224, 231, 255, ${p.alpha})`;
        ctx.fill();
      }

      if (isPlaying && !prefersReducedMotion) {
        time += 0.016;
        animationFrameId = window.requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  const currentPrompt = SHOWCASE_PROMPTS[activePromptIndex];

  return (
    <div className="relative mx-auto flex h-[430px] w-full max-w-[460px] flex-col justify-between overflow-hidden rounded-[28px] border border-[var(--dc-border)] bg-slate-950 shadow-2xl shadow-indigo-950/20 sm:h-[500px] lg:h-[540px]">
      {/* Animated canvas video backdrop */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      />

      {/* Subtle vignette overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/40"
      />

      {/* Top status bar */}
      <div className="relative z-10 flex items-center justify-between p-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]" />
          <span>DeepChat Studio</span>
        </div>

        <button
          type="button"
          onClick={() => setIsPlaying((prev) => !prev)}
          aria-label={isPlaying ? 'Pause ambient video' : 'Play ambient video'}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/90 backdrop-blur-md transition-colors hover:bg-white/20"
        >
          {isPlaying ? (
            <span className="flex items-center gap-0.5" aria-hidden="true">
              <span className="h-2.5 w-0.5 rounded-full bg-current" />
              <span className="h-2.5 w-0.5 rounded-full bg-current" />
            </span>
          ) : (
            <Play className="h-3.5 w-3.5 translate-x-[1px]" />
          )}
        </button>
      </div>

      {/* Bottom floating prompt card */}
      <div className="relative z-10 p-5 sm:p-6">
        <div
          key={currentPrompt.tag}
          className={`rounded-2xl border border-white/15 bg-gradient-to-br ${currentPrompt.accent} bg-slate-900/75 p-4 backdrop-blur-xl transition-all duration-500`}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-indigo-200 uppercase">
              {currentPrompt.tag}
            </span>
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {SHOWCASE_PROMPTS.map((item, idx) => (
                <span
                  key={item.tag}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === activePromptIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/35'
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="text-sm leading-relaxed font-medium text-white/95">
            &ldquo;{currentPrompt.prompt}&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}
