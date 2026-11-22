'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  Image as ImageIcon,
  MoreHorizontal,
  Paperclip,
  PenLine,
  Plus,
  RectangleHorizontal,
  RectangleVertical,
  Scan,
  Square,
  SquareMousePointer,
  X,
} from '@/components/ui/icons';
import { type ImageAspectRatio } from '@/lib/images/image-aspect-ratio';

export interface ComposerToolsFile {
  name: string;
  ext: string;
  previewUrl?: string;
  dataUrl?: string;
  content?: string;
  size?: number;
}

export interface ComposerToolsRecentFile extends ComposerToolsFile {
  chatId: string;
  chatTitle: string;
  addedAt: string;
}

type FileIconRenderer = (ext: string, className: string) => React.ReactNode;
type FileDisplayNameGetter = (name: string) => string;

interface ComposerToolsMenuProps {
  isOpen: boolean;
  onExited?: () => void;
  isUploading?: boolean;
  webSearchEnabled?: boolean;
  imageGenerationEnabled?: boolean;
  imageAspectRatio: ImageAspectRatio;
  uploadShortcut: string[];
  recentFiles: ComposerToolsRecentFile[];
  onUpload: () => void;
  onAttachRecentFile: (file: ComposerToolsFile) => void;
  onToggleWebSearch?: (enabled: boolean) => void;
  onToggleImageGeneration?: (enabled: boolean) => void;
  onImageAspectRatioChange?: (aspectRatio: ImageAspectRatio) => void;
  onClose: () => void;
  getFileIcon: FileIconRenderer;
  getDisplayName: FileDisplayNameGetter;
}

const ASPECT_RATIO_OPTIONS: {
  value: ImageAspectRatio;
  label: string;
  hint?: string;
  icon: React.ReactNode;
}[] = [
  { value: 'auto', label: 'Auto', icon: <Scan className="h-4 w-4" /> },
  { value: '1:1', label: 'Square', hint: '1:1', icon: <Square className="h-4 w-4" /> },
  { value: '3:4', label: 'Portrait', hint: '3:4', icon: <RectangleVertical className="h-4 w-4" /> },
  { value: '9:16', label: 'Story', hint: '9:16', icon: <RectangleVertical className="h-4 w-4" /> },
  { value: '4:3', label: 'Landscape', hint: '4:3', icon: <RectangleHorizontal className="h-4 w-4" /> },
  { value: '16:9', label: 'Widescreen', hint: '16:9', icon: <RectangleHorizontal className="h-4 w-4" /> },
];

const getAspectRatioLabel = (value: ImageAspectRatio) => {
  const option = ASPECT_RATIO_OPTIONS.find((item) => item.value === value);
  return option?.hint || option?.label || 'Auto';
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ToolsAnimatedCheckSvg({
  active,
  className = 'h-4 w-4 text-blue-600 dark:text-sky-400',
}: {
  active: boolean;
  className?: string;
}) {
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const pathEl = pathRef.current;
    if (!pathEl) return;
    if (!active) {
      gsap.set(pathEl, { strokeDashoffset: 22, opacity: 0 });
      return;
    }
    const reduce = prefersReducedMotion();
    gsap.fromTo(
      pathEl,
      { strokeDashoffset: 22, opacity: 0.4 },
      {
        strokeDashoffset: 0,
        opacity: 1,
        duration: reduce ? 0.01 : 0.28,
        ease: 'power3.out',
      }
    );
  }, [active]);

  if (!active) return null;

  return (
    <svg
      viewBox="0 0 18 18"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path
        ref={pathRef}
        d="M4 9.5L7.4 12.8L14 5.5"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="22"
      />
    </svg>
  );
}

function animateRowPointer(target: HTMLButtonElement, entered: boolean, tilt = 0) {
  if (prefersReducedMotion()) return;
  const iconEl = target.querySelector<HTMLElement>('.dc-tools-icon');
  const chevronEl = target.querySelector<HTMLElement>('.dc-tools-chevron');
  if (iconEl) {
    gsap.to(iconEl, {
      scale: entered ? 1.12 : 1,
      rotation: entered ? tilt : 0,
      duration: entered ? 0.24 : 0.2,
      ease: entered ? 'back.out(2.1)' : 'power2.out',
      overwrite: 'auto',
    });
  }
  if (chevronEl) {
    gsap.to(chevronEl, {
      x: entered ? 3 : 0,
      duration: 0.2,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  }
}

export function ComposerToolsMenu({
  isOpen,
  onExited,
  isUploading,
  webSearchEnabled,
  imageGenerationEnabled,
  uploadShortcut,
  recentFiles,
  onUpload,
  onAttachRecentFile,
  onToggleWebSearch,
  onToggleImageGeneration,
  onClose,
  getFileIcon,
  getDisplayName,
}: ComposerToolsMenuProps) {
  const [view, setView] = useState<'main' | 'recent' | 'more'>('main');
  const panelRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const viewDirectionRef = useRef(0);
  const wasOpenRef = useRef(false);
  const onExitedRef = useRef(onExited);

  useEffect(() => {
    onExitedRef.current = onExited;
  });

  const switchView = useCallback((nextView: 'main' | 'recent' | 'more') => {
    viewDirectionRef.current = nextView === 'main' ? -1 : 1;
    setView(nextView);
  }, []);

  // Panel open / close choreography
  useEffect(() => {
    const panelEl = panelRef.current;
    if (!panelEl) return;
    const reduce = prefersReducedMotion();

    if (isOpen) {
      wasOpenRef.current = true;
      gsap.killTweensOf(panelEl);
      gsap.fromTo(
        panelEl,
        { opacity: 0, y: reduce ? 0 : 10, scale: reduce ? 1 : 0.96 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: reduce ? 0.01 : 0.26,
          ease: 'expo.out',
          clearProps: 'transform',
        }
      );

      if (!reduce) {
        const items = panelEl.querySelectorAll<HTMLElement>('.dc-tools-stagger');
        if (items.length > 0) {
          gsap.fromTo(
            items,
            { opacity: 0, y: 6 },
            {
              opacity: 1,
              y: 0,
              duration: 0.22,
              delay: 0.025,
              stagger: 0.022,
              ease: 'expo.out',
              clearProps: 'transform,opacity',
            }
          );
        }
      }
      return;
    }

    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      gsap.killTweensOf(panelEl);
      gsap.to(panelEl, {
        opacity: 0,
        y: reduce ? 0 : 8,
        scale: reduce ? 1 : 0.965,
        duration: reduce ? 0.01 : 0.16,
        ease: 'power2.in',
        onComplete: () => {
          setView('main');
          viewDirectionRef.current = 0;
          onExitedRef.current?.();
        },
      });
    }
  }, [isOpen]);

  // Directional view slide + item stagger when drilling into Recent / More
  useEffect(() => {
    if (!isOpen || viewDirectionRef.current === 0) return;
    const viewEl = viewRef.current;
    if (!viewEl) return;
    const dir = viewDirectionRef.current;
    viewDirectionRef.current = 0;

    if (prefersReducedMotion()) return;
    gsap.killTweensOf(viewEl);
    gsap.fromTo(
      viewEl,
      { opacity: 0, x: dir * 16 },
      {
        opacity: 1,
        x: 0,
        duration: 0.24,
        ease: 'expo.out',
        clearProps: 'transform,opacity',
      }
    );

    const items = viewEl.querySelectorAll<HTMLElement>('.dc-tools-stagger');
    if (items.length > 0) {
      gsap.fromTo(
        items,
        { opacity: 0, y: 5 },
        {
          opacity: 1,
          y: 0,
          duration: 0.2,
          delay: 0.02,
          stagger: 0.02,
          ease: 'expo.out',
          clearProps: 'transform,opacity',
        }
      );
    }
  }, [isOpen, view]);

  const openLibrary = () => {
    window.dispatchEvent(new Event('openFileLibrary'));
    onClose();
  };

  return (
    <div
      ref={panelRef}
      role="menu"
      aria-label="Composer tools"
      className="dc-tools-panel absolute bottom-full left-0 z-50 mb-3 w-[min(17.75rem,calc(100vw-24px))] origin-bottom-left p-1.5"
    >
      <div ref={viewRef}>
        {view === 'main' && (
          <div className="space-y-0.5">
            <button
              type="button"
              disabled={isUploading}
              onClick={onUpload}
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, true, -10);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, false, 0);
              }}
              className="dc-tools-row dc-tools-stagger group/row disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="dc-tools-icon-well">
                <Paperclip className="dc-tools-icon h-[16px] w-[16px]" strokeWidth={2.05} />
              </span>
              <span className="min-w-0 flex-1 whitespace-nowrap text-[13.5px] font-medium">
                Add photos &amp; files
              </span>
              {uploadShortcut.length > 0 && (
                <span className="shrink-0 text-[11px] font-semibold tracking-tight text-[var(--dc-text-faint)] opacity-0 transition-opacity duration-150 group-focus-visible/row:opacity-100 group-hover/row:opacity-100">
                  {uploadShortcut.join('+')}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => switchView('recent')}
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, true);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, false);
              }}
              className="dc-tools-row dc-tools-stagger"
            >
              <span className="dc-tools-icon-well">
                <FileText className="dc-tools-icon h-[16px] w-[16px]" strokeWidth={2.05} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                Recent files
              </span>
              <ChevronRight className="dc-tools-chevron h-4 w-4 shrink-0 text-[var(--dc-text-muted)]" />
            </button>

            <div className="dc-tools-divider dc-tools-stagger" />

            <button
              type="button"
              onClick={() => {
                onToggleImageGeneration?.(!imageGenerationEnabled);
                onClose();
              }}
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, true);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, false);
              }}
              className={`dc-tools-row dc-tools-stagger ${imageGenerationEnabled ? 'dc-tools-row-active' : ''}`}
            >
              <span className="dc-tools-icon-well">
                <ImageIcon className="dc-tools-icon h-[16px] w-[16px]" strokeWidth={2.05} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                Create image
              </span>
              <ToolsAnimatedCheckSvg active={Boolean(imageGenerationEnabled)} />
            </button>

            <button
              type="button"
              onClick={onClose}
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, true);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, false);
              }}
              className="dc-tools-row dc-tools-stagger"
            >
              <span className="dc-tools-icon-well">
                <BookOpen className="dc-tools-icon h-[16px] w-[16px]" strokeWidth={2.05} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                Deep research
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onToggleWebSearch?.(!webSearchEnabled);
                onClose();
              }}
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, true);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, false);
              }}
              className={`dc-tools-row dc-tools-stagger ${webSearchEnabled ? 'dc-tools-row-active' : ''}`}
            >
              <span className="dc-tools-icon-well">
                <Globe className="dc-tools-icon h-[16px] w-[16px]" strokeWidth={2.05} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                Web search
              </span>
              <ToolsAnimatedCheckSvg active={Boolean(webSearchEnabled)} />
            </button>

            <button
              type="button"
              onClick={() => switchView('more')}
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, true);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, false);
              }}
              className="dc-tools-row dc-tools-stagger"
            >
              <span className="dc-tools-icon-well">
                <MoreHorizontal className="dc-tools-icon h-[16px] w-[16px]" strokeWidth={2.05} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                More
              </span>
              <ChevronRight className="dc-tools-chevron h-4 w-4 shrink-0 text-[var(--dc-text-muted)]" />
            </button>
          </div>
        )}

        {view === 'recent' && (
          <div>
            <div className="mb-1 flex items-center justify-between gap-2 px-0.5 py-0.5">
              <button
                type="button"
                onClick={() => switchView('main')}
                className="dc-tools-back-btn"
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.3} />
                <span>Recent files</span>
              </button>
              <button
                type="button"
                onClick={openLibrary}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-semibold text-[var(--deepchat-accent)] transition-opacity hover:opacity-80"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Library</span>
              </button>
            </div>

            <div className="dc-tools-divider" />

            {recentFiles.length > 0 ? (
              <div className="custom-scrollbar max-h-60 space-y-0.5 overflow-y-auto pr-0.5">
                {recentFiles.map((file) => (
                  <button
                    key={`${file.chatId}-${file.name}-${file.ext}`}
                    type="button"
                    onClick={() =>
                      onAttachRecentFile({
                        name: file.name,
                        ext: file.ext,
                        previewUrl: file.previewUrl,
                        dataUrl: file.dataUrl,
                        content: file.content,
                        size: file.size,
                      })
                    }
                    onPointerEnter={(e) => {
                      if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, true);
                    }}
                    onPointerLeave={(e) => {
                      if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, false);
                    }}
                    className="dc-tools-row dc-tools-stagger"
                  >
                    <span className="dc-tools-icon-well">
                      <span className="dc-tools-icon flex items-center justify-center">
                        {getFileIcon(file.ext, 'h-4 w-4')}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium leading-5 text-[var(--dc-text-strong)]">
                        {getDisplayName(file.name)}
                      </span>
                      <span className="block truncate text-[11px] font-medium leading-4 text-[var(--dc-text-muted)]">
                        {formatRecentFileTime(file.addedAt)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-7 text-center text-[12.5px] font-medium text-[var(--dc-text-muted)]">
                No recent files yet
              </div>
            )}
          </div>
        )}

        {view === 'more' && (
          <div>
            <div className="mb-1 flex items-center justify-between px-0.5 py-0.5">
              <button
                type="button"
                onClick={() => switchView('main')}
                className="dc-tools-back-btn"
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.3} />
                <span>More tools</span>
              </button>
            </div>

            <div className="dc-tools-divider" />

            <div className="space-y-0.5">
              <button
                type="button"
                onClick={onClose}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, true);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, false);
                }}
                className="dc-tools-row dc-tools-stagger"
              >
                <span className="dc-tools-icon-well">
                  <SquareMousePointer className="dc-tools-icon h-[16px] w-[16px]" strokeWidth={2.05} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                  Agent mode
                </span>
              </button>

              <button
                type="button"
                onClick={onClose}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, true);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, false);
                }}
                className="dc-tools-row dc-tools-stagger"
              >
                <span className="dc-tools-icon-well relative">
                  <PenLine className="dc-tools-icon h-[16px] w-[16px]" strokeWidth={2.05} />
                  <Plus className="absolute right-0.5 top-0.5 h-2.5 w-2.5 text-[var(--deepchat-accent)]" strokeWidth={2.5} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                  Canvas
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SearchToolBadge({
  enabled,
  onDisable,
}: {
  enabled?: boolean;
  onDisable?: () => void;
}) {
  const badgeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = badgeRef.current;
    if (!el || prefersReducedMotion()) return;
    gsap.fromTo(
      el,
      { opacity: 0, scale: 0.9, x: -6 },
      { opacity: 1, scale: 1, x: 0, duration: 0.26, ease: 'back.out(1.7)', clearProps: 'transform,opacity' }
    );
  }, [enabled]);

  if (!enabled) return null;

  const handleClick = () => {
    const el = badgeRef.current;
    if (!el || prefersReducedMotion()) {
      onDisable?.();
      return;
    }
    gsap.to(el, {
      opacity: 0,
      scale: 0.92,
      duration: 0.13,
      ease: 'power2.in',
      onComplete: () => onDisable?.(),
    });
  };

  return (
    <button
      ref={badgeRef}
      type="button"
      onClick={handleClick}
      className="dc-tools-chip group/search-tool inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-[13.5px] font-medium active:scale-95"
      aria-label="Disable web search"
      aria-pressed="true"
    >
      <span className="relative h-[17px] w-[17px] shrink-0">
        <Globe
          className="absolute inset-0 h-[17px] w-[17px] transition-all duration-150 group-hover/search-tool:scale-75 group-hover/search-tool:opacity-0"
          strokeWidth={2.2}
        />
        <X
          className="absolute inset-0 h-[17px] w-[17px] scale-75 opacity-0 transition-all duration-150 group-hover/search-tool:scale-100 group-hover/search-tool:opacity-100"
          strokeWidth={2.35}
        />
      </span>
      <span>Search</span>
    </button>
  );
}

export function ImageToolBadge({
  enabled,
  aspectRatio,
  onDisable,
  onAspectRatioChange,
}: {
  enabled?: boolean;
  aspectRatio: ImageAspectRatio;
  onDisable?: () => void;
  onAspectRatioChange?: (aspectRatio: ImageAspectRatio) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMenuRendered, setIsMenuRendered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<HTMLSpanElement>(null);
  const wasMenuOpenRef = useRef(false);

  const selectedOption =
    ASPECT_RATIO_OPTIONS.find((option) => option.value === aspectRatio) || ASPECT_RATIO_OPTIONS[0];
  const isAspectMenuOpen = Boolean(enabled && isOpen);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el || prefersReducedMotion()) return;
    gsap.fromTo(
      el,
      { opacity: 0, scale: 0.9, x: -6 },
      { opacity: 1, scale: 1, x: 0, duration: 0.26, ease: 'back.out(1.7)', clearProps: 'transform,opacity' }
    );
  }, [enabled]);

  useEffect(() => {
    const chevronEl = chevronRef.current;
    if (!chevronEl) return;
    const reduce = prefersReducedMotion();
    gsap.to(chevronEl, {
      rotation: isAspectMenuOpen ? 180 : 0,
      duration: reduce ? 0.01 : 0.26,
      ease: 'power3.out',
    });
  }, [isAspectMenuOpen]);

  useEffect(() => {
    if (!isMenuRendered) return;
    const menuEl = menuRef.current;
    if (!menuEl) return;
    const reduce = prefersReducedMotion();

    if (isAspectMenuOpen) {
      wasMenuOpenRef.current = true;
      gsap.killTweensOf(menuEl);
      gsap.fromTo(
        menuEl,
        { opacity: 0, y: reduce ? 0 : 8, scale: reduce ? 1 : 0.96 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: reduce ? 0.01 : 0.24,
          ease: 'expo.out',
          clearProps: 'transform',
        }
      );
      if (!reduce) {
        const rows = menuEl.querySelectorAll<HTMLElement>('.dc-tools-stagger');
        if (rows.length > 0) {
          gsap.fromTo(
            rows,
            { opacity: 0, y: 5 },
            {
              opacity: 1,
              y: 0,
              duration: 0.2,
              stagger: 0.02,
              ease: 'expo.out',
              clearProps: 'transform,opacity',
            }
          );
        }
      }
      return;
    }

    if (wasMenuOpenRef.current) {
      wasMenuOpenRef.current = false;
      gsap.killTweensOf(menuEl);
      gsap.to(menuEl, {
        opacity: 0,
        y: reduce ? 0 : 7,
        scale: reduce ? 1 : 0.965,
        duration: reduce ? 0.01 : 0.15,
        ease: 'power2.in',
        onComplete: () => setIsMenuRendered(false),
      });
    }
  }, [isAspectMenuOpen, isMenuRendered]);

  useEffect(() => {
    if (!isAspectMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAspectMenuOpen]);

  if (!enabled) return null;

  const toggleMenu = () => {
    if (isAspectMenuOpen) {
      setIsOpen(false);
    } else {
      setIsMenuRendered(true);
      setIsOpen(true);
    }
  };

  const handleDisableClick = () => {
    setIsOpen(false);
    setIsMenuRendered(false);
    const el = containerRef.current;
    if (!el || prefersReducedMotion()) {
      onDisable?.();
      return;
    }
    gsap.to(el, {
      opacity: 0,
      scale: 0.92,
      duration: 0.13,
      ease: 'power2.in',
      onComplete: () => onDisable?.(),
    });
  };

  return (
    <div
      ref={containerRef}
      className="dc-tools-chip relative inline-flex h-9 shrink-0 items-center rounded-full text-[13.5px] font-medium"
    >
      <button
        type="button"
        onClick={handleDisableClick}
        className="group/image-tool inline-flex h-9 shrink-0 items-center gap-2 rounded-l-full px-3 transition-colors hover:bg-[rgb(15_23_42/0.04)] dark:hover:bg-[rgb(255_255_255/0.06)]"
        aria-label="Disable image generation"
        aria-pressed="true"
      >
        <span className="relative h-[17px] w-[17px] shrink-0">
          <ImageIcon
            className="absolute inset-0 h-[17px] w-[17px] transition-all duration-150 group-hover/image-tool:scale-75 group-hover/image-tool:opacity-0"
            strokeWidth={2.2}
          />
          <X
            className="absolute inset-0 h-[17px] w-[17px] scale-75 opacity-0 transition-all duration-150 group-hover/image-tool:scale-100 group-hover/image-tool:opacity-100"
            strokeWidth={2.35}
          />
        </span>
        <span>Image</span>
      </button>

      <span className="h-4 w-px bg-[var(--dc-border)]" aria-hidden="true" />

      <button
        type="button"
        onClick={toggleMenu}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-r-full px-2.5 pr-3 text-[var(--dc-text)] transition-colors hover:bg-[rgb(15_23_42/0.04)] dark:hover:bg-[rgb(255_255_255/0.06)]"
        aria-label="Choose image aspect ratio"
        aria-expanded={isAspectMenuOpen}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--dc-text-muted)]">
          {selectedOption.icon}
        </span>
        <span>{getAspectRatioLabel(aspectRatio)}</span>
        <span
          ref={chevronRef}
          className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[var(--dc-text-muted)]"
        >
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.35} />
        </span>
      </button>

      {isMenuRendered && (
        <div
          ref={menuRef}
          className="dc-tools-panel absolute bottom-full left-0 z-[70] mb-2.5 w-[min(16rem,calc(100vw-24px))] origin-bottom-left p-1.5"
        >
          <div className="space-y-0.5">
            {ASPECT_RATIO_OPTIONS.map((option) => {
              const active = aspectRatio === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onAspectRatioChange?.(option.value);
                    setIsOpen(false);
                  }}
                  onPointerEnter={(e) => {
                    if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, true);
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === 'mouse') animateRowPointer(e.currentTarget, false);
                  }}
                  className={`dc-tools-row dc-tools-stagger ${active ? 'dc-tools-row-active' : ''}`}
                >
                  <span className="dc-tools-icon-well">
                    <span className="dc-tools-icon flex items-center justify-center">
                      {option.icon}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                    {option.label}
                  </span>
                  {option.hint && (
                    <span className="shrink-0 text-[11.5px] font-semibold text-[var(--dc-text-muted)]">
                      {option.hint}
                    </span>
                  )}
                  <ToolsAnimatedCheckSvg active={active} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRecentFileTime(value: string) {
  if (!value) return 'Recently added';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently added';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
