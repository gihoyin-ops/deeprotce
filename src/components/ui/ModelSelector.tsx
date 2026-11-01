'use client';

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Layers,
  BrainCircuit,
  Gauge,
  SlidersHorizontal
} from '@/components/ui/icons';
import { useShortcutLabels } from '@/components/shortcuts';
import Tooltip from '@/components/ui/Tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { isImageGenerationModel } from '@/lib/images/image-generation';

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
  { key: 'Ultra', valuetext: 'Ultra - smartest, consumes usage limits faster', speed: 'Max Reasoning' }
];

const LIVE_CHAT_CONNECTION_ID = 'live-chat';
const LIVE_LITE_CONNECTION_ID = 'live-lite';

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
    badge: 'Default',
    description: getModelDescription('gemma4:31b', 'Gemma 4')
  },
  {
    id: 'llama4:70b',
    name: 'Llama 4',
    badge: 'Lite',
    description: getModelDescription('llama4:70b', 'Llama 4')
  }
];
const emptySubscribe = () => () => {};


const getConnectionIdForModel = (modelId: string): string => {
  if (modelId.toLowerCase().includes('llama') || modelId.toLowerCase().includes('lite')) {
    return LIVE_LITE_CONNECTION_ID;
  }
  return LIVE_CHAT_CONNECTION_ID;
};

const toSelectedModel = (option: ModelOption): SelectedModel => ({
  id: option.id,
  name: formatFrontendModelName(option.id, option.name),
  connectionId: getConnectionIdForModel(option.id)
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
      connectionId: parsed.connectionId || getConnectionIdForModel(parsed.id)
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
  desktopOnly = false
}: {
  renderTrigger?: boolean;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [isOpen, setIsOpen] = useState(false);
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
  const trackRef = useRef<HTMLDivElement>(null);
  const sparklesCanvasRef = useRef<HTMLCanvasElement>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);

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

  // detect mobile viewport under 640px
  useEffect(() => {
    const updateViewport = () => {
      setIsMobileViewport(window.matchMedia('(max-width: 639px)').matches);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  // fetch env-defined models from api without remote lookup
  useEffect(() => {
    let cancelled = false;
    fetch('/api/live/models', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then((data: { default?: string; models?: ModelOption[] } | null) => {
        if (cancelled) return;
        const sourceList = data?.models && data.models.length > 0 ? data.models : DEFAULT_FALLBACK_MODELS;
        const list = sourceList
          .filter(m => m.badge !== 'Image' && !isImageGenerationModel(m.id))
          .map(m => {
            const formattedName = formatFrontendModelName(m.id, m.name);
            return {
              ...m,
              name: formattedName,
              description: getModelDescription(m.id, formattedName, m.description)
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
        const found = stored && !isImageGenerationModel(stored.id) && list.find(m => m.id === stored.id);
        if (found) {
          const fresh = toSelectedModel(found);
          setSelectedModel(fresh);
          persistModel(fresh);
        } else {
          const defId = data?.default || list[0].id;
          const def = list.find(m => m.id === defId) || list[0];
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

    const handleOpen = () => {
      const isDesktop = window.matchMedia('(min-width: 640px)').matches;
      if (mobileOnly && isDesktop) return;
      if (desktopOnly && !isDesktop) return;
      setView('menu');
      setIsOpen(true);
    };

    const handleClose = () => setIsOpen(false);

    window.addEventListener('storage', syncModel);
    window.addEventListener('modelSelected', syncModel);
    window.addEventListener('openModelSelector', handleOpen);
    window.addEventListener('closeModelSelector', handleClose);

    return () => {
      window.removeEventListener('storage', syncModel);
      window.removeEventListener('modelSelected', syncModel);
      window.removeEventListener('openModelSelector', handleOpen);
      window.removeEventListener('closeModelSelector', handleClose);
    };
  }, [desktopOnly, mobileOnly]);

  // close on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (containerRef.current && containerRef.current.contains(target)) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectModel = useCallback((option: ModelOption) => {
    const next = toSelectedModel(option);
    setSelectedModel(next);
    persistModel(next);
    window.dispatchEvent(new CustomEvent('modelSelected', { detail: next }));
    setIsOpen(false);
  }, []);

  const fireConfetti = useCallback(() => {
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
    const COLORS = ['#C9B0F0', '#BFA5F2', '#D4C3F7', '#B79EF5'];
    const R = 17;
    const N = 14;

    const newParticles: ConfettiParticle[] = [];
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const sp = 105 + Math.random() * 45;
      newParticles.push({
        x: cx + Math.cos(ang) * R,
        y: cy + Math.sin(ang) * R,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 25,
        size: 4.5 + Math.random() * 1,
        life: 0,
        ttl: 0.2 + Math.random() * 0.08,
        color: COLORS[i % COLORS.length]
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

      confettiPartsRef.current = confettiPartsRef.current.filter(p => {
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
  const handleCommitTier = useCallback((index: number) => {
    const clamped = Math.min(4, Math.max(0, index));
    setTierIndex(clamped);
    persistEffort(clamped);
    if (clamped === 4) {
      fireConfetti();
    }
  }, [fireConfetti]);

  // initialize sparkles particles
  const initParticles = useCallback((w: number, h: number) => {
    const count = Math.max(6, Math.round(w / 24));
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: 4 + Math.random() * (h - 8),
      r: 0.8 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
      twinkle: 2.5 + Math.random() * 4.5,
      flow: 85 + Math.random() * 50
    }));
  }, []);

  // draw sparkles canvas
  useEffect(() => {
    if (!isOpen || view !== 'advanced') {
      cancelAnimationFrame(sparkRafRef.current);
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
      const dt = Math.min(0.032, Math.max(0, (time - sparkLastRefRef.current) / 1000));
      sparkLastRefRef.current = time;

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

    const sparkLastRefRef = sparkLastRef;
    sparkRafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(sparkRafRef.current);
    };
  }, [initParticles, isOpen, view]);

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
    left: `calc(17px + ${effectivePos} * (100% - 34px))`
  };
  const fillStyle = {
    width: `calc(17px + ${effectivePos} * (100% - 34px) + 17px)`
  };

  // Popover panel content
  const popoverContent = (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Model settings"
      className={`overflow-hidden rounded-[20px] border border-black/[0.08] dark:border-white/[0.1] bg-white/95 dark:bg-[#161618]/95 backdrop-blur-md text-[#1A1D21] dark:text-[#F3F4F6] shadow-[0_4px_24px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.08)] transition-all select-none ${
        view === 'models' ? 'w-[310px]' : 'w-[270px]'
      } max-w-[calc(100vw-32px)]`}
    >
      <AnimatePresence mode="wait">
        {view === 'menu' ? (
          <motion.div
            key="menu"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
            className="p-1.5 space-y-0.5"
          >
            {/* Model Item - Clicking reveals the models list ("dipencet dulu baru muncul") */}
            <button
              type="button"
              onClick={() => setView('models')}
              className="group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-[#0371DD] dark:bg-blue-400/15 dark:text-[#38BDF8]">
                  <Layers className="h-4 w-4" />
                </div>
                <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                  Model
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 pl-2">
                <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[110px]">
                  {selectedModel.name}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            {/* Effort */}
            <button
              type="button"
              onClick={() => setView('advanced')}
              className="group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-[#7C3AED] dark:bg-purple-400/15 dark:text-[#A78BFA]">
                  <BrainCircuit className="h-4 w-4" />
                </div>
                <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                  Effort
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 pl-2">
                <span
                  className={`text-[13px] font-medium ${
                    isUltra
                      ? 'text-[#7C3AED] dark:text-[#A78BFA]'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {currentTier.key}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            {/* Speed */}
            <button
              type="button"
              onClick={() => setView('advanced')}
              className="group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
                  <Gauge className="h-4 w-4" />
                </div>
                <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                  Speed
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 pl-2">
                <span className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
                  {currentTier.speed}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>

            <div className="my-1 h-px bg-slate-100 dark:bg-white/[0.08]" />

            {/* Advanced */}
            <button
              type="button"
              onClick={() => setView('advanced')}
              className="flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              <span className="text-[12px] font-medium">Advanced</span>
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ) : view === 'models' ? (
          <motion.div
            key="models"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
            className="p-1.5 space-y-1"
          >
            {/* Top row: clean back navigation button, NO TITLE above the models */}
            <div className="flex items-center px-1 pt-0.5 pb-1">
              <button
                type="button"
                onClick={() => setView('menu')}
                className="group inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                <span>Back</span>
              </button>
            </div>

            {/* DIRECTLY the models: Name and short description without any title headers above */}
            {loading ? (
              <div className="space-y-1.5 p-1">
                <div className="h-14 animate-pulse rounded-xl bg-black/[0.04] dark:bg-white/[0.05]" />
                <div className="h-14 animate-pulse rounded-xl bg-black/[0.04] dark:bg-white/[0.05]" />
              </div>
            ) : models.length > 0 ? (
              <div className="space-y-1 max-h-[320px] overflow-y-auto overflow-x-hidden pr-0.5">
                {models.map(m => {
                  const isSelected = m.id === selectedModel.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectModel(m)}
                      className={`group relative flex w-full items-start justify-between gap-2.5 rounded-xl p-2.5 text-left transition-all ${
                        isSelected
                          ? 'bg-[#0371DD]/[0.08] dark:bg-[#38BDF8]/[0.12] ring-1 ring-[#0371DD]/30 dark:ring-[#38BDF8]/40'
                          : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span
                          className={`text-[13px] font-semibold leading-tight ${
                            isSelected
                              ? 'text-[#0371DD] dark:text-[#38BDF8]'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {m.name}
                        </span>
                        {m.description && (
                          <span className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                            {m.description}
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0371DD] text-white dark:bg-[#38BDF8] dark:text-slate-950">
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-slate-400">No models found</div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="advanced"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
            className="p-3.5"
          >
            {/* dynamic header */}
            <div className="relative mb-3 flex h-[24px] items-center justify-between">
              {isUltra ? (
                <div className="flex w-full items-center justify-center">
                  <span className="bg-gradient-to-r from-[#7C3AED] to-[#9333EA] bg-clip-text text-[13px] font-semibold text-transparent">
                    Consumes usage limits faster
                  </span>
                </div>
              ) : isHoveringSlider || isDragging ? (
                <div className="flex w-full items-center justify-between text-[13px] text-slate-500 dark:text-slate-400">
                  <span>Faster</span>
                  <span>Smarter</span>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setView('menu')}
                    className="group inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                    <span>Back</span>
                  </button>
                  <svg className="text-[#0371DD]" width="15" height="15" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093Z" />
                  </svg>
                </>
              )}
            </div>

            {/* interactive slider */}
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
              className={`relative h-[38px] select-none touch-none outline-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            >
              {/* track */}
              <div
                ref={trackRef}
                className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[28px] rounded-full bg-[#E1E1E4] dark:bg-[#2A2A2E] overflow-hidden"
              >
                {/* 5 ticks */}
                <div className="absolute inset-0 pointer-events-none">
                  {[0, 1, 2, 3, 4].map(idx => (
                    <div
                      key={idx}
                      style={{ left: `calc(17px + ${(idx / 4)} * (100% - 34px))` }}
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-[5px] h-[5px] rounded-full bg-black/20 dark:bg-white/20"
                    />
                  ))}
                </div>

                {/* animated fill */}
                <div
                  style={fillStyle}
                  className={`absolute left-0 top-0 bottom-0 rounded-full overflow-hidden bg-[#0371DD] transition-[width] ${
                    isDragging ? 'duration-0' : 'duration-300 ease-out'
                  }`}
                >
                  {/* ultra gradient overlay */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-r from-[#2E61D4] via-[#A57BFD] to-[#8B73F3] transition-opacity duration-300 ${
                      isUltra ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  {/* sparkles canvas */}
                  <canvas ref={sparklesCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                </div>
              </div>

              {/* knob */}
              <div
                style={knobStyle}
                className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-[34px] h-[34px] rounded-full bg-white shadow-[0_0_0_0.5px_rgba(26,29,33,0.04),0_1px_2px_rgba(26,29,33,0.12),0_2px_6px_rgba(26,29,33,0.16)] transition-[left,transform] ${
                  isDragging ? 'scale-105 duration-0' : 'duration-300 ease-out'
                }`}
              />

              {/* confetti burst canvas */}
              <canvas ref={confettiCanvasRef} className="absolute -left-8 -top-10 pointer-events-none z-10" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // Desktop dropup panel positioned above the trigger
  const desktopPanel = (
    <div className="absolute bottom-[calc(100%+8px)] right-0 z-50 origin-bottom-right">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 4 }}
        transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
      >
        {popoverContent}
      </motion.div>
    </div>
  );

  // Mobile bottom sheet
  const mobileSheet = (
    <div className="fixed inset-0 z-50 sm:hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setIsOpen(false)}
        className="absolute inset-0 bg-black/50 backdrop-blur-xs"
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="absolute bottom-0 left-0 right-0 max-h-[80dvh] rounded-t-3xl border-t border-black/10 dark:border-white/10 bg-white dark:bg-[#161618] px-4 pb-6 pt-3 shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
        <div className="flex justify-center">{popoverContent}</div>
      </motion.div>
    </div>
  );

  const menu = isMobileViewport ? (
    mounted && typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {isOpen && mobileSheet}
          </AnimatePresence>,
          document.body
        )
      : null
  ) : (
    <AnimatePresence>
      {isOpen && desktopPanel}
    </AnimatePresence>
  );

  if (!renderTrigger) return menu;

  return (
    <div ref={containerRef} className="relative inline-block">
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
            setIsOpen(prev => !prev);
            setView('menu');
          }}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className="flex h-9 w-full max-w-[250px] items-center justify-between rounded-full bg-[#F1F2F3] hover:bg-[#E8E9EB] dark:bg-[#1E1E22] dark:hover:bg-[#28282D] px-3.5 text-[#1A1D21] dark:text-[#F3F4F6] border border-black/[0.06] dark:border-white/[0.08] transition-all duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[#0371DD]"
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <svg className="h-3.5 w-3.5 shrink-0 text-slate-700 dark:text-slate-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093Z" />
            </svg>
            <span className="truncate text-[13px] font-semibold tracking-tight">{selectedModel.name}</span>
            <span
              className={`text-[13px] transition-colors duration-200 ${
                isUltra
                  ? 'text-[#7C3AED] dark:text-[#A78BFA] font-medium'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {currentTier.key}
            </span>
          </div>
          <svg
            className={`h-3 w-3 shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 ml-1.5 ${
              isOpen ? 'rotate-180' : ''
            }`}
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path d="M2.5 4.25 6 7.75l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </Tooltip>
      {menu}
    </div>
  );
}
