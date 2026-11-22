'use client';

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import {
  ChevronRight,
  ChevronLeft,
  Layers,
  BrainCircuit,
  Gauge,
  SlidersHorizontal,
} from '@/components/ui/icons';
import { useShortcutLabels } from '@/components/shortcuts';
import Tooltip from '@/components/ui/Tooltip';
import { isImageGenerationModel } from '@/lib/images/image-generation';
import {
  AnimatedCheckSvg,
  SliderWaveSvg,
  UltraPrismBorderSvg,
} from './ModelSelectorVisuals';

export interface SelectedModel {
  id: string;
  name: string;
  connectionId: string;
}

export interface ModelOption {
  id: string;
  name: string;
  badge?: string;
  description?: string;
}

interface Tier {
  key: string;
  valuetext: string;
  speed: string;
}

const TIERS: Tier[] = [
  { key: 'Light', valuetext: 'Light - fastest', speed: 'Ultra Fast' },
  { key: 'Medium', valuetext: 'Medium - balanced', speed: 'Fast' },
  { key: 'High', valuetext: 'High - smarter', speed: 'Thinking' },
  { key: 'Extra High', valuetext: 'Extra High - much smarter', speed: 'Deep Thinking' },
  { key: 'Ultra', valuetext: 'Ultra - smartest, consumes usage limits faster', speed: 'Max Reasoning' },
];

const LIVE_CHAT_CONNECTION_ID = 'live-chat';
const LIVE_LITE_CONNECTION_ID = 'live-lite';
const emptySubscribe = () => () => {};

export const formatFrontendModelName = (modelId: string, modelName?: string): string => {
  const target = (modelName || modelId || '').toLowerCase();
  if (target.includes('gemma')) {
    return 'Gemma 4';
  }
  if (target.includes('llama')) {
    return 'Llama 4';
  }
  if (target.includes('gpt-4o')) {
    return 'GPT-4o';
  }
  if (target.includes('gpt-4')) {
    return 'GPT-4';
  }
  if (target.includes('claude-3-5') || target.includes('claude-3.5')) {
    return 'Claude 3.5';
  }
  if (target.includes('claude')) {
    return 'Claude 3';
  }
  if (target.includes('deepseek')) {
    return 'DeepSeek R1';
  }
  const clean = (modelName || modelId).replace(/:[\w.-]+/g, '').replace(/[-_]/g, ' ').trim();
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : modelId;
};

export const getModelDescription = (modelId: string, modelName?: string, rawDesc?: string): string => {
  const target = `${modelId} ${modelName || ''}`.toLowerCase();
  if (target.includes('gemma')) {
    return 'Model by Google, specialized in deep reasoning, coding, and multilingual dialogue';
  }
  if (target.includes('llama')) {
    return 'Model by Meta, specialized in versatile conversation, logic, and general knowledge';
  }
  if (target.includes('deepseek')) {
    return 'Model by DeepSeek, specialized in advanced mathematics, code, and step-by-step logic';
  }
  if (target.includes('gpt-4o')) {
    return 'Model by OpenAI, specialized in high-speed multimodal intelligence and complex tasks';
  }
  if (target.includes('gpt-4')) {
    return 'Model by OpenAI, specialized in broad problem solving, writing, and deep analysis';
  }
  if (target.includes('claude-3-5') || target.includes('claude-3.5')) {
    return 'Model by Anthropic, specialized in nuanced coding, detailed writing, and analysis';
  }
  if (target.includes('claude')) {
    return 'Model by Anthropic, specialized in safe reasoning, creative tasks, and writing';
  }
  if (target.includes('gemini')) {
    return 'Model by Google, specialized in multimodal processing and long-context reasoning';
  }
  if (target.includes('mistral') || target.includes('codestral')) {
    return 'Model by Mistral AI, specialized in fast reasoning and concise generation';
  }
  if (target.includes('qwen')) {
    return 'Model by Alibaba Cloud, specialized in multilingual reasoning and programming';
  }
  if (target.includes('phi')) {
    return 'Model by Microsoft, specialized in compact high-efficiency reasoning';
  }
  if (rawDesc && rawDesc !== 'Main chat model' && rawDesc !== 'Fast & lightweight tasks') {
    return rawDesc;
  }
  return 'High-performance AI model specialized in reasoning and conversational tasks';
};

const DEFAULT_FALLBACK_MODELS: ModelOption[] = [
  {
    id: 'gemma4:31b',
    name: 'Gemma 4',
    description: getModelDescription('gemma4:31b', 'Gemma 4'),
  },
  {
    id: 'llama4:70b',
    name: 'Llama 4',
    description: getModelDescription('llama4:70b', 'Llama 4'),
  },
];

const getConnectionIdForModel = (modelId: string): string => {
  if (modelId.toLowerCase().includes('llama') || modelId.toLowerCase().includes('lite')) {
    return LIVE_LITE_CONNECTION_ID;
  }
  return LIVE_CHAT_CONNECTION_ID;
};

const toSelectedModel = (option: ModelOption): SelectedModel => ({
  id: option.id,
  name: formatFrontendModelName(option.id, option.name),
  connectionId: getConnectionIdForModel(option.id),
});

const persistModel = (model: SelectedModel) => {
  try {
    localStorage.setItem('selectedModelObj', JSON.stringify(model));
    localStorage.setItem('selectedModel', model.id);
  } catch {}
};

const loadStoredModel = (): SelectedModel | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem('selectedModelObj');
    if (!saved) return null;
    const parsed = JSON.parse(saved) as Partial<SelectedModel>;
    if (!parsed.id) return null;
    return {
      id: parsed.id,
      name: formatFrontendModelName(parsed.id, parsed.name),
      connectionId: parsed.connectionId || getConnectionIdForModel(parsed.id),
    };
  } catch {
    return null;
  }
};

const loadStoredEffort = (): number => {
  if (typeof window === 'undefined') return 1;
  try {
    const saved = localStorage.getItem('selectedModelEffort');
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 4) return parsed;
    }
  } catch {}
  return 1;
};

const persistEffort = (index: number) => {
  try {
    localStorage.setItem('selectedModelEffort', String(index));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('modelEffortChanged', { detail: index }));
  }
};

interface Particle {
  x: number;
  y: number;
  r: number;
  phase: number;
  twinkle: number;
  flow: number;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  ttl: number;
  color: string;
}

export default function ModelSelector({
  renderTrigger = true,
  mobileOnly = false,
  desktopOnly = false,
  variant = 'chip',
}: {
  renderTrigger?: boolean;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
  variant?: 'chip' | 'ghost';
}) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [isOpen, setIsOpen] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [view, setView] = useState<'menu' | 'models' | 'advanced'>('menu');
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<SelectedModel>(() => {
    const stored = loadStoredModel();
    if (stored && !isImageGenerationModel(stored.id)) return stored;
    return { id: 'gemma4:31b', name: 'Gemma 4', connectionId: LIVE_CHAT_CONNECTION_ID };
  });
  const [tierIndex, setTierIndex] = useState<number>(() => loadStoredEffort());
  const [loading, setLoading] = useState(true);
  const [isHoveringSlider, setIsHoveringSlider] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const viewPanelRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<SVGSVGElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const sparklesCanvasRef = useRef<HTMLCanvasElement>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);

  const viewDirectionRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const sparkRafRef = useRef<number>(0);
  const sparkLastRef = useRef<number>(0);

  const confettiPartsRef = useRef<ConfettiParticle[]>([]);
  const confettiRafRef = useRef<number>(0);
  const confettiLastRef = useRef<number>(0);
  const lastBurstRef = useRef<number>(0);

  const activePointerRef = useRef<number | null>(null);
  const shortcuts = useShortcutLabels();

  const currentTier = TIERS[tierIndex] || TIERS[1];
  const isUltra = tierIndex === 4;

  const openSelector = useCallback(() => {
    viewDirectionRef.current = 0;
    setView('menu');
    setIsRendered(true);
    setIsOpen(true);
    window.dispatchEvent(new Event('modelSelectorOpened'));
  }, []);

  const closeSelector = useCallback(() => {
    setIsOpen(false);
  }, []);

  const switchView = useCallback((nextView: 'menu' | 'models' | 'advanced') => {
    viewDirectionRef.current = nextView === 'menu' ? -1 : 1;
    setView(nextView);
  }, []);

  // detect mobile viewport under 640px
  useEffect(() => {
    const updateViewport = () => {
      setIsMobileViewport(window.matchMedia('(max-width: 639px)').matches);
    };
    const frame = window.requestAnimationFrame(updateViewport);
    window.addEventListener('resize', updateViewport);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  // fetch env-defined models from api without remote lookup
  useEffect(() => {
    let cancelled = false;
    fetch('/api/live/models', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { default?: string; models?: ModelOption[] } | null) => {
        if (cancelled) return;
        const sourceList = data?.models && data.models.length > 0 ? data.models : DEFAULT_FALLBACK_MODELS;
        const list = sourceList
          .filter((m) => m.badge !== 'Image' && !isImageGenerationModel(m.id))
          .map((m) => {
            const formattedName = formatFrontendModelName(m.id, m.name);
            return {
              ...m,
              name: formattedName,
              description: getModelDescription(m.id, formattedName, m.description),
            };
          });

        if (list.length === 0) {
          setModels(DEFAULT_FALLBACK_MODELS);
          setLoading(false);
          return;
        }
        setModels(list);
        setLoading(false);

        const stored = loadStoredModel();
        const found = stored && !isImageGenerationModel(stored.id) && list.find((m) => m.id === stored.id);
        if (found) {
          const fresh = toSelectedModel(found);
          setSelectedModel(fresh);
          persistModel(fresh);
        } else {
          const defId = data?.default || list[0].id;
          const def = list.find((m) => m.id === defId) || list[0];
          const next = toSelectedModel(def);
          setSelectedModel(next);
          persistModel(next);
          window.dispatchEvent(new CustomEvent('modelSelected', { detail: next }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModels(DEFAULT_FALLBACK_MODELS);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // sync state with external events and storage
  useEffect(() => {
    const syncModel = () => {
      const stored = loadStoredModel();
      if (stored) setSelectedModel(stored);
      setTierIndex(loadStoredEffort());
    };

    const syncEffort = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === 'number') {
        setTierIndex(event.detail);
      } else {
        setTierIndex(loadStoredEffort());
      }
    };

    const handleOpen = () => {
      const isDesktop = window.matchMedia('(min-width: 640px)').matches;
      if (mobileOnly && isDesktop) return;
      if (desktopOnly && !isDesktop) return;
      openSelector();
    };

    const handleClose = () => {
      closeSelector();
    };

    window.addEventListener('storage', syncModel);
    window.addEventListener('modelSelected', syncModel);
    window.addEventListener('modelEffortChanged', syncEffort);
    window.addEventListener('openModelSelector', handleOpen);
    window.addEventListener('closeModelSelector', handleClose);

    return () => {
      window.removeEventListener('storage', syncModel);
      window.removeEventListener('modelSelected', syncModel);
      window.removeEventListener('modelEffortChanged', syncEffort);
      window.removeEventListener('openModelSelector', handleOpen);
      window.removeEventListener('closeModelSelector', handleClose);
    };
  }, [closeSelector, desktopOnly, mobileOnly, openSelector]);

  // close on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (containerRef.current && containerRef.current.contains(target)) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      closeSelector();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSelector();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeSelector, isOpen]);

  // animate trigger chevron smoothly with GSAP
  useEffect(() => {
    const chevronEl = chevronRef.current;
    if (!chevronEl) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(chevronEl, { rotate: isOpen ? 180 : 0 });
      return;
    }

    gsap.to(chevronEl, {
      rotate: isOpen ? 180 : 0,
      duration: 0.28,
      ease: 'power3.out',
    });
  }, [isOpen]);

  // animate desktop dropup & mobile bottom sheet open/close with GSAP
  useEffect(() => {
    if (!isRendered) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const panelEl = popoverRef.current;
    const backdropEl = backdropRef.current;
    const sheetEl = sheetRef.current;

    if (isOpen) {
      if (isMobileViewport) {
        if (backdropEl) {
          gsap.fromTo(
            backdropEl,
            { opacity: 0 },
            { opacity: 1, duration: reduceMotion ? 0.01 : 0.24, ease: 'power2.out' }
          );
        }
        if (sheetEl) {
          gsap.fromTo(
            sheetEl,
            { y: reduceMotion ? 0 : '100%' },
            {
              y: 0,
              duration: reduceMotion ? 0.01 : 0.38,
              ease: 'expo.out',
              clearProps: 'transform',
            }
          );
        }
      } else if (panelEl) {
        gsap.fromTo(
          panelEl,
          { opacity: 0, y: reduceMotion ? 0 : 8, scale: reduceMotion ? 1 : 0.96 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: reduceMotion ? 0.01 : 0.24,
            ease: 'expo.out',
            clearProps: 'transform',
          }
        );
      }
      return;
    }

    if (reduceMotion) {
      const frame = window.requestAnimationFrame(() => setIsRendered(false));
      return () => window.cancelAnimationFrame(frame);
    }

    const tl = gsap.timeline({
      onComplete: () => setIsRendered(false),
    });

    if (isMobileViewport) {
      if (sheetEl) {
        tl.to(sheetEl, { y: '100%', duration: 0.24, ease: 'power3.in' }, 0);
      }
      if (backdropEl) {
        tl.to(backdropEl, { opacity: 0, duration: 0.22, ease: 'power2.in' }, 0);
      }
    } else if (panelEl) {
      tl.to(
        panelEl,
        { opacity: 0, y: 6, scale: 0.965, duration: 0.16, ease: 'power2.in' },
        0
      );
    } else {
      const frame = window.requestAnimationFrame(() => setIsRendered(false));
      return () => window.cancelAnimationFrame(frame);
    }

    return () => {
      tl.kill();
    };
  }, [isOpen, isRendered, isMobileViewport]);

  // animate view transitions, staggered rows, and fine-pointer SVG micro-interactions
  useEffect(() => {
    if (!isOpen || !isRendered) return;
    const panelEl = viewPanelRef.current;
    if (!panelEl) return;

    const dir = viewDirectionRef.current;
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (dir !== 0) {
        gsap.fromTo(
          panelEl,
          { opacity: 0, x: dir * 10 },
          { opacity: 1, x: 0, duration: 0.22, ease: 'expo.out', clearProps: 'transform' }
        );
      }

      const items = panelEl.querySelectorAll<HTMLElement>('.dc-ms-stagger');
      if (items.length > 0) {
        gsap.fromTo(
          items,
          { opacity: 0, y: 5 },
          {
            opacity: 1,
            y: 0,
            duration: 0.24,
            stagger: 0.025,
            ease: 'power2.out',
            clearProps: 'transform',
          }
        );
      }
    });

    const cleanups: (() => void)[] = [];
    if (
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const rows = panelEl.querySelectorAll<HTMLElement>('.dc-ms-interactive-row');
      rows.forEach((row) => {
        const iconEl = row.querySelector<HTMLElement>('.dc-ms-row-svg');
        const arrowEl = row.querySelector<HTMLElement>('.dc-ms-row-chevron');

        const onEnter = () => {
          if (iconEl) {
            gsap.to(iconEl, { scale: 1.1, rotate: -6, duration: 0.34, ease: 'back.out(2.2)' });
          }
          if (arrowEl) {
            gsap.to(arrowEl, { x: 2.5, duration: 0.22, ease: 'power2.out' });
          }
        };

        const onLeave = () => {
          if (iconEl) {
            gsap.to(iconEl, { scale: 1, rotate: 0, duration: 0.24, ease: 'power3.out' });
          }
          if (arrowEl) {
            gsap.to(arrowEl, { x: 0, duration: 0.22, ease: 'power3.out' });
          }
        };

        row.addEventListener('mouseenter', onEnter);
        row.addEventListener('mouseleave', onLeave);
        cleanups.push(() => {
          row.removeEventListener('mouseenter', onEnter);
          row.removeEventListener('mouseleave', onLeave);
        });
      });
    }

    return () => {
      cleanups.forEach((fn) => fn());
      mm.revert();
    };
  }, [view, isOpen, isRendered]);

  const handleSelectModel = useCallback(
    (option: ModelOption) => {
      const next = toSelectedModel(option);
      setSelectedModel(next);
      persistModel(next);
      window.dispatchEvent(new CustomEvent('modelSelected', { detail: next }));
      closeSelector();
    },
    [closeSelector]
  );

  const fireConfetti = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const now = performance.now();
    if (now - lastBurstRef.current < 350) return;
    lastBurstRef.current = now;

    const track = trackRef.current;
    const canvas = confettiCanvasRef.current;
    if (!track || !canvas) return;

    const sw = track.offsetWidth;
    const sh = track.offsetHeight;
    if (!sw) return;

    const MX = 32;
    const MY = 40;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = sw + MX * 2;
    const h = sh + MY * 2;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const cx = sw - 17 + MX;
    const cy = sh / 2 + MY;
    const COLORS = ['#60A5FA', '#818CF8', '#C084FC', '#F472B6', '#38BDF8'];
    const R = 17;
    const N = 16;

    const newParticles: ConfettiParticle[] = [];
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const sp = 105 + Math.random() * 45;
      newParticles.push({
        x: cx + Math.cos(ang) * R,
        y: cy + Math.sin(ang) * R,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 25,
        size: 4 + Math.random() * 1.4,
        life: 0,
        ttl: 0.24 + Math.random() * 0.08,
        color: COLORS[i % COLORS.length],
      });
    }

    confettiPartsRef.current = newParticles;
    confettiLastRef.current = now;

    const tick = (t: number) => {
      const dt = Math.min(0.032, Math.max(0, (t - confettiLastRef.current) / 1000));
      confettiLastRef.current = t;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      confettiPartsRef.current = confettiPartsRef.current.filter((p) => {
        p.life += dt;
        if (p.life >= p.ttl) return false;
        const damp = Math.exp(-6 * dt);
        p.vx *= damp;
        p.vy = p.vy * damp - 20 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = p.life / p.ttl;
        ctx.globalAlpha = Math.pow(1 - k, 1.5);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });
      ctx.globalAlpha = 1;

      if (confettiPartsRef.current.length > 0) {
        confettiRafRef.current = requestAnimationFrame(tick);
      } else {
        confettiRafRef.current = 0;
        ctx.clearRect(0, 0, w, h);
      }
    };

    cancelAnimationFrame(confettiRafRef.current);
    confettiRafRef.current = requestAnimationFrame(tick);
  }, []);

  const handleCommitTier = useCallback(
    (index: number) => {
      const clamped = Math.min(4, Math.max(0, index));
      setTierIndex(clamped);
      persistEffort(clamped);
      if (clamped === 4) {
        fireConfetti();
      }
    },
    [fireConfetti]
  );

  // initialize sparkles particles
  const initParticles = useCallback((w: number, h: number) => {
    const count = Math.max(6, Math.round(w / 24));
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: 4 + Math.random() * (h - 8),
      r: 0.8 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
      twinkle: 2.5 + Math.random() * 4.5,
      flow: 85 + Math.random() * 50,
    }));
  }, []);

  // draw sparkles canvas
  useEffect(() => {
    if (!isOpen || !isRendered || view !== 'advanced') {
      cancelAnimationFrame(sparkRafRef.current);
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const canvas = sparklesCanvasRef.current;
    const track = trackRef.current;
    if (!canvas || !track) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = track.clientWidth;
    const h = track.clientHeight;
    if (w <= 0 || h <= 0) return;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    initParticles(w, h);

    sparkLastRef.current = performance.now();

    const loop = (time: number) => {
      const dt = Math.min(0.032, Math.max(0, (time - sparkLastRef.current) / 1000));
      sparkLastRef.current = time;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        const sec = time / 1000;

        for (const p of particlesRef.current) {
          p.x -= p.flow * dt;
          if (p.x < -3) p.x += w + 6;
          const s = 0.5 + 0.5 * Math.sin(sec * p.twinkle + p.phase);
          ctx.globalAlpha = 0.08 + 0.76 * s * s;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      sparkRafRef.current = requestAnimationFrame(loop);
    };

    sparkRafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(sparkRafRef.current);
    };
  }, [initParticles, isOpen, isRendered, view]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(confettiRafRef.current);
    };
  }, []);

  // slider pointer drag handling
  const handleSliderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== null) return;
    activePointerRef.current = e.pointerId;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);

    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const w = track.clientWidth;
    const K = 34;
    const frac = (e.clientX - rect.left) / rect.width;
    const pos = Math.min(1, Math.max(0, (frac * w - K / 2) / (w - K)));
    setDragPos(pos);
    const nearest = Math.round(pos * 4);
    if (nearest !== tierIndex) {
      setTierIndex(nearest);
      persistEffort(nearest);
    }
  };

  const handleSliderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || e.pointerId !== activePointerRef.current) return;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const w = track.clientWidth;
    const K = 34;
    const frac = (e.clientX - rect.left) / rect.width;
    const pos = Math.min(1, Math.max(0, (frac * w - K / 2) / (w - K)));
    setDragPos(pos);
    const nearest = Math.round(pos * 4);
    if (nearest !== tierIndex) {
      setTierIndex(nearest);
      persistEffort(nearest);
    }
  };

  const handleSliderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || e.pointerId !== activePointerRef.current) return;
    setIsDragging(false);
    activePointerRef.current = null;
    const pos = dragPos ?? tierIndex / 4;
    setDragPos(null);
    const target = Math.round(pos * 4);
    handleCommitTier(target);
  };

  const handleSliderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      handleCommitTier(tierIndex + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      handleCommitTier(tierIndex - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      handleCommitTier(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      handleCommitTier(4);
    }
  };

  // computed knob position
  const effectivePos = dragPos ?? tierIndex / 4;
  const knobStyle = {
    left: `calc(17px + ${effectivePos} * (100% - 34px))`,
  };
  const fillStyle = {
    width: `calc(17px + ${effectivePos} * (100% - 34px) + 17px)`,
  };

  const panelBody = (
    <div ref={viewPanelRef}>
      {view === 'menu' ? (
        <div key="menu" className="space-y-0.5 p-1.5 sm:p-2">
          <button
            type="button"
            onClick={() => switchView('models')}
            className="dc-ms-row dc-ms-stagger dc-ms-interactive-row min-h-[44px]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="dc-ms-row-icon bg-blue-500/10 text-[#0371DD] dark:bg-blue-400/15 dark:text-[#38BDF8]">
                <Layers className="dc-ms-row-svg h-4 w-4" />
              </div>
              <span className="text-[13.5px] font-semibold text-[var(--dc-text-strong)]">
                Model
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 pl-2">
              <span className="max-w-[120px] truncate text-[13px] font-medium text-[var(--dc-text-muted)]">
                {selectedModel.name}
              </span>
              <ChevronRight className="dc-ms-row-chevron h-3.5 w-3.5 text-[var(--dc-text-faint)]" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => switchView('advanced')}
            className="dc-ms-row dc-ms-stagger dc-ms-interactive-row min-h-[44px]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="dc-ms-row-icon bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-400">
                <BrainCircuit className="dc-ms-row-svg h-4 w-4" />
              </div>
              <span className="text-[13.5px] font-semibold text-[var(--dc-text-strong)]">
                Effort
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 pl-2">
              <span
                className={`text-[13px] font-medium ${
                  isUltra ? 'dc-ms-ultra-text font-semibold' : 'text-[var(--dc-text-muted)]'
                }`}
              >
                {currentTier.key}
              </span>
              <ChevronRight className="dc-ms-row-chevron h-3.5 w-3.5 text-[var(--dc-text-faint)]" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => switchView('advanced')}
            className="dc-ms-row dc-ms-stagger dc-ms-interactive-row min-h-[44px]"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="dc-ms-row-icon bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
                <Gauge className="dc-ms-row-svg h-4 w-4" />
              </div>
              <span className="text-[13.5px] font-semibold text-[var(--dc-text-strong)]">
                Speed
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 pl-2">
              <span className="text-[13px] font-medium text-[var(--dc-text-muted)]">
                {currentTier.speed}
              </span>
              <ChevronRight className="dc-ms-row-chevron h-3.5 w-3.5 text-[var(--dc-text-faint)]" />
            </div>
          </button>

          <div className="dc-ms-divider" />

          <button
            type="button"
            onClick={() => switchView('advanced')}
            className="dc-ms-row dc-ms-stagger dc-ms-interactive-row min-h-[38px] text-[var(--dc-text-muted)]"
          >
            <span className="text-[12.5px] font-medium">Advanced</span>
            <SlidersHorizontal className="dc-ms-row-svg h-3.5 w-3.5" />
          </button>
        </div>
      ) : view === 'models' ? (
        <div key="models" className="space-y-1 p-2">
          <div className="flex items-center px-0.5 pb-1 pt-0.5">
            <button
              type="button"
              onClick={() => switchView('menu')}
              className="dc-ms-back-btn group"
            >
              <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Back</span>
            </button>
          </div>

          {loading ? (
            <div className="space-y-1.5 p-1">
              <div className="h-14 animate-pulse rounded-xl bg-black/[0.04] dark:bg-white/[0.05]" />
              <div className="h-14 animate-pulse rounded-xl bg-black/[0.04] dark:bg-white/[0.05]" />
            </div>
          ) : models.length > 0 ? (
            <div className="custom-scrollbar max-h-[min(320px,52dvh)] space-y-1 overflow-y-auto overflow-x-hidden pr-0.5">
              {models.map((m) => {
                const isSelected = m.id === selectedModel.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectModel(m)}
                    className={`dc-ms-model-item dc-ms-stagger ${
                      isSelected
                        ? isUltra
                          ? 'dc-ms-model-item-ultra'
                          : 'dc-ms-model-item-active'
                        : ''
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span
                        className={`text-[13.5px] font-semibold leading-tight ${
                          isSelected
                            ? isUltra
                              ? 'text-[var(--dc-text-strong)]'
                              : 'text-[#0371DD] dark:text-[#38BDF8]'
                            : 'text-[var(--dc-text-strong)]'
                        }`}
                      >
                        {m.name}
                      </span>
                      {m.description && (
                        <span className="text-[11.5px] leading-relaxed text-[var(--dc-text-muted)]">
                          {m.description}
                        </span>
                      )}
                    </div>
                    {isSelected && <AnimatedCheckSvg isUltra={isUltra} />}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-5 text-center text-xs text-[var(--dc-text-muted)]">No models found</div>
          )}
        </div>
      ) : (
        <div key="advanced" className="p-3.5 sm:p-4">
          <div className="relative mb-3 flex min-h-[24px] items-center justify-between gap-2">
            {isUltra ? (
              <>
                <button
                  type="button"
                  onClick={() => switchView('menu')}
                  className="dc-ms-back-btn group shrink-0"
                  aria-label="Back to menu"
                >
                  <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                  <span className="sm:hidden">Back</span>
                </button>
                <span className="dc-ms-ultra-text flex-1 truncate text-center text-[12.5px] font-semibold">
                  Consumes usage limits faster
                </span>
                <span className="w-6 shrink-0" aria-hidden="true" />
              </>
            ) : isHoveringSlider || isDragging ? (
              <div className="flex w-full items-center justify-between text-[12.5px] font-medium text-[var(--dc-text-muted)]">
                <span>Faster</span>
                <span>Smarter</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => switchView('menu')}
                className="dc-ms-back-btn group"
              >
                <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                <span>Back</span>
              </button>
            )}
          </div>

          <div
            tabIndex={0}
            role="slider"
            aria-label="Model intelligence"
            aria-valuemin={0}
            aria-valuemax={4}
            aria-valuenow={tierIndex}
            aria-valuetext={currentTier.valuetext}
            onKeyDown={handleSliderKeyDown}
            onPointerEnter={() => setIsHoveringSlider(true)}
            onPointerLeave={() => setIsHoveringSlider(false)}
            onPointerDown={handleSliderPointerDown}
            onPointerMove={handleSliderPointerMove}
            onPointerUp={handleSliderPointerUp}
            onPointerCancel={handleSliderPointerUp}
            className={`relative h-[38px] select-none touch-none outline-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <div
              ref={trackRef}
              className="dc-ms-slider-track absolute left-0 right-0 top-1/2 -translate-y-1/2"
            >
              <div className="pointer-events-none absolute inset-0">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <div
                    key={idx}
                    style={{ left: `calc(17px + ${idx / 4} * (100% - 34px))` }}
                    className={`absolute top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-200 ${
                      idx <= tierIndex
                        ? 'bg-white/45'
                        : 'bg-black/20 dark:bg-white/20'
                    }`}
                  />
                ))}
              </div>

              <div
                style={fillStyle}
                className={`dc-ms-slider-fill transition-[width] ${
                  isDragging ? 'duration-0' : 'duration-300 ease-out'
                }`}
              >
                <div
                  className={`dc-ms-ultra-fill absolute inset-0 transition-opacity duration-300 ${
                    isUltra ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <SliderWaveSvg active={tierIndex >= 2} isUltra={isUltra} />
                <canvas
                  ref={sparklesCanvasRef}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                />
              </div>
            </div>

            <div
              style={knobStyle}
              className={`dc-ms-slider-knob -translate-x-1/2 -translate-y-1/2 transition-[left,transform,box-shadow] ${
                isUltra ? 'dc-ms-slider-knob-ultra' : ''
              } ${isDragging ? 'scale-105 duration-0' : 'duration-300 ease-out'}`}
            />

            <canvas
              ref={confettiCanvasRef}
              className="pointer-events-none absolute -left-8 -top-10 z-10"
            />
          </div>
        </div>
      )}
    </div>
  );

  const desktopPanel = (
    <div className="absolute bottom-[calc(100%+10px)] right-0 z-50 origin-bottom-right">
      <div
        ref={popoverRef}
        role="dialog"
        aria-label="Model settings"
        className={`dc-ms-panel ${isUltra ? 'dc-ms-panel-ultra' : ''} select-none transition-[width] duration-200 ${
          view === 'models'
            ? 'w-[min(324px,calc(100vw-24px))]'
            : 'w-[min(286px,calc(100vw-24px))]'
        }`}
      >
        {isUltra && <div className="dc-ms-ultra-top-seam" aria-hidden="true" />}
        {panelBody}
      </div>
    </div>
  );

  const mobileSheet = (
    <div className="fixed inset-0 z-[9990] flex flex-col justify-end sm:hidden">
      <div
        ref={backdropRef}
        onClick={closeSelector}
        className="dc-ms-backdrop fixed inset-0"
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        className="relative z-10 w-full"
      >
        <div
          ref={popoverRef}
          role="dialog"
          aria-modal="true"
          aria-label="Model settings"
          className="dc-ms-sheet max-h-[82dvh] w-full select-none px-3 pb-[calc(1.1rem+env(safe-area-inset-bottom))] pt-2.5"
        >
          {isUltra && <div className="dc-ms-ultra-top-seam" aria-hidden="true" />}
          <div className="dc-ms-sheet-handle mx-auto mb-2.5 h-1.5 w-11 rounded-full" />
          <div className="mx-auto w-full max-w-[440px]">{panelBody}</div>
        </div>
      </div>
    </div>
  );

  const menu = !isRendered
    ? null
    : isMobileViewport
      ? mounted && typeof document !== 'undefined'
        ? createPortal(mobileSheet, document.body)
        : null
      : desktopPanel;

  if (!renderTrigger) return menu;

  return (
    <div ref={containerRef} className="relative inline-block max-w-full">
      <Tooltip
        label="Select model"
        shortcuts={[{ label: shortcuts.selectModel.join('+'), tone: 'muted' }]}
        side="bottom"
        align="end"
        disabled={isOpen}
      >
        <button
          type="button"
          onClick={() => {
            if (isOpen) {
              closeSelector();
            } else {
              openSelector();
            }
          }}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={`dc-ms-trigger h-9 w-full max-w-[240px] px-3.5 ${
            isUltra
              ? 'dc-ms-trigger-ultra'
              : variant === 'ghost'
                ? 'dc-ms-trigger-ghost'
                : 'dc-ms-trigger-chip'
          }`}
        >
          <UltraPrismBorderSvg active={isUltra} />

          <div className="relative z-10 flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold tracking-tight">
              {selectedModel.name}
            </span>
            <span
              className="h-1 w-1 shrink-0 rounded-full bg-current opacity-25"
              aria-hidden="true"
            />
            <span
              className={`shrink-0 text-[12.5px] transition-colors duration-200 ${
                isUltra
                  ? 'dc-ms-ultra-text font-semibold'
                  : 'font-medium text-[var(--dc-text-muted)]'
              }`}
            >
              {currentTier.key}
            </span>
          </div>

          <svg
            ref={chevronRef}
            className="relative z-10 ml-1.5 h-3 w-3 shrink-0 text-[var(--dc-text-muted)]"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2.5 4.25 6 7.75l3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </Tooltip>
      {menu}
    </div>
  );
}
