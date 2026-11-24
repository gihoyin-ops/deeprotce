'use client';

import React, { useEffect, useRef } from 'react';

export default function LoginShowcaseMedia() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

    const particles = Array.from({ length: 28 }, (_, i) => ({
      angle: (i / 28) * Math.PI * 2,
      radius: 0.16 + (i % 6) * 0.055,
      speed: 0.0018 + (i % 5) * 0.0006,
      size: 1.2 + (i % 3) * 0.8,
      alpha: 0.18 + (i % 4) * 0.12,
    }));

    const renderFrame = () => {
      ctx.clearRect(0, 0, width, height);

      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#090d16');
      bgGrad.addColorStop(0.55, '#111827');
      bgGrad.addColorStop(1, '#14192d');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const cx = width * 0.5;
      const cy = height * 0.5;
      const baseRadius = Math.min(width, height) * 0.36;

      // Smoothly drifting atmospheric light fields
      const orb1X = cx + Math.cos(time * 0.55) * (width * 0.12);
      const orb1Y = cy + Math.sin(time * 0.42) * (height * 0.1);
      const glow1 = ctx.createRadialGradient(orb1X, orb1Y, 0, orb1X, orb1Y, baseRadius * 1.65);
      glow1.addColorStop(0, 'rgba(99, 102, 241, 0.44)');
      glow1.addColorStop(0.5, 'rgba(56, 189, 248, 0.16)');
      glow1.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = glow1;
      ctx.fillRect(0, 0, width, height);

      const orb2X = cx - Math.sin(time * 0.48) * (width * 0.14);
      const orb2Y = cy + Math.cos(time * 0.36) * (height * 0.12);
      const glow2 = ctx.createRadialGradient(orb2X, orb2Y, 0, orb2X, orb2Y, baseRadius * 1.45);
      glow2.addColorStop(0, 'rgba(168, 85, 247, 0.34)');
      glow2.addColorStop(0.55, 'rgba(79, 70, 229, 0.12)');
      glow2.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = glow2;
      ctx.fillRect(0, 0, width, height);

      // Subtle harmonic waves
      for (let r = 0; r < 3; r++) {
        ctx.beginPath();
        const phase = time * (0.7 + r * 0.22) + r * 1.6;
        for (let x = 0; x <= width; x += 12) {
          const norm = x / Math.max(1, width);
          const y =
            cy +
            Math.sin(norm * 5 + phase) * (26 + r * 12) +
            Math.cos(norm * 3 - phase * 0.7) * 14;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle =
          r === 0
            ? 'rgba(129, 140, 248, 0.34)'
            : r === 1
              ? 'rgba(56, 189, 248, 0.22)'
              : 'rgba(192, 132, 252, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Soft drifting particles
      for (const p of particles) {
        const currentAngle = p.angle + time * p.speed * 60;
        const px = cx + Math.cos(currentAngle) * (Math.min(width, height) * p.radius);
        const py = cy + Math.sin(currentAngle * 1.15) * (Math.min(width, height) * p.radius * 0.8);
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(224, 231, 255, ${p.alpha})`;
        ctx.fill();
      }

      if (!prefersReducedMotion) {
        time += 0.016;
        animationFrameId = window.requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="relative mx-auto h-[420px] w-full max-w-[460px] overflow-hidden rounded-[24px] bg-slate-950 sm:h-[500px] lg:h-[540px]">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="block h-full w-full"
      />
    </div>
  );
}
