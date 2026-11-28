'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import NextImage from 'next/image';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { gsap } from 'gsap';
import {
  AlertCircle,
  ArrowUp,
  BookOpen,
  Code2,
  CornerDownLeft,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Plus,
  Square,
  Video,
  Volume2,
  X,
} from '@/components/ui/icons';
import { getChats } from '@/app/actions';
import { isShortcutEvent, useShortcutLabels } from '@/components/shortcuts';
import ModelSelector from './ModelSelector';
import Tooltip from './Tooltip';
import { CanvasToolBadge, ComposerToolsMenu, ImageToolBadge, SearchToolBadge } from './ComposerToolsMenu';
import AttachmentPreviewModal from './AttachmentPreviewModal';
import PdfCoverThumbnail from './PdfCoverThumbnail';
import DictateAbstractOrb from './DictateAbstractOrb';
import GlobalImagePreviewModal from './GlobalImagePreviewModal';
import {
  getDictationLanguage,
  loadGeneralSettings,
  subscribeGeneralSettings,
} from '@/lib/settings/general-settings';
import { type ImageAspectRatio } from '@/lib/images/image-aspect-ratio';
import { deepchatQueryKeys } from '@/lib/query-keys';
import { useGuestStatus } from '@/lib/auth/guest';
import { openAuthModal } from '@/lib/auth/auth-url';
import { formatRemainingTime, useActiveLimit } from '@/lib/security/client-limit';

export interface ComposerFile {
  name: string;
  ext: string;
  previewUrl?: string;
  dataUrl?: string;
  content?: string;
  size?: number;
}

interface ComposerRecentFile extends ComposerFile {
  chatId: string;
  chatTitle: string;
  addedAt: string;
}

interface ComposerChatMessage {
  attachedFiles?: ComposerFile[];
  createdAt?: string;
}

interface ComposerChatSummary {
  id?: string;
  title?: string;
  createdAt?: string;
  pendingAttachedFiles?: ComposerFile[];
  messages?: ComposerChatMessage[];
}

interface TextareaSlot {
  left: number;
  top: number;
  width: number;
  minHeight: number;
}

interface ChatComposerProps {
  value: string;
  attachedFiles: ComposerFile[];
  isUploading?: boolean;
  isBusy?: boolean;
  webSearchEnabled?: boolean;
  imageGenerationEnabled?: boolean;
  canvasEnabled?: boolean;
  imageAspectRatio?: ImageAspectRatio;
  placeholder?: string;
  maxTextareaHeight?: number;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onStop?: () => void;
  onToggleWebSearch?: (enabled: boolean) => void;
  onToggleImageGeneration?: (enabled: boolean) => void;
  onToggleCanvas?: (enabled: boolean) => void;
  onImageAspectRatioChange?: (aspectRatio: ImageAspectRatio) => void;
  onFilesUpload: (files: File[]) => void;
  onAttachRecentFile: (file: ComposerFile) => void;
  onRemoveFile: (index: number) => void;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string } | undefined;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike | undefined;
  };
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event?: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'heic', 'heif', 'avif']);
const CODE_EXTS = new Set([
  'ts', 'js', 'tsx', 'jsx', 'json', 'html', 'css', 'scss', 'less',
  'py', 'sql', 'xml', 'yaml', 'yml', 'sh', 'bash', 'env', 'ini', 'toml',
  'java', 'go', 'rs', 'c', 'cpp', 'h', 'hpp', 'rb', 'php', 'swift', 'kt',
  'vue', 'svelte', 'graphql', 'prisma',
]);
const SPREADSHEET_EXTS = new Set(['csv', 'tsv', 'xls', 'xlsx', 'ods']);
const VIDEO_EXTS = new Set(['mp4', 'mkv', 'webm', 'avi', 'mov']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac']);
const DOC_EXTS = new Set(['md', 'markdown', 'txt', 'doc', 'docx', 'rtf', 'log']);

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const getSpeechRecognitionConstructor = () => {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
};

const getComposerRecentFiles = async () => {
  const chats = (await getChats()) as ComposerChatSummary[];
  const seen = new Set<string>();
  return chats
    .flatMap((chat) => {
      if (!chat.id) return [];
      const pending = (chat.pendingAttachedFiles || []).map((file) => ({
        ...file,
        chatId: chat.id || '',
        chatTitle: chat.title || 'New Chat',
        addedAt: chat.createdAt || '',
      }));
      const fromMessages = (chat.messages || []).flatMap((message) =>
        (message.attachedFiles || []).map((file) => ({
          ...file,
          chatId: chat.id || '',
          chatTitle: chat.title || 'New Chat',
          addedAt: message.createdAt || chat.createdAt || '',
        }))
      );
      return [...pending, ...fromMessages];
    })
    .filter((file) => {
      const key = `${file.name}-${file.ext}`;
      if (!file.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
};

export default function ChatComposer({
  value,
  attachedFiles,
  isUploading = false,
  isBusy = false,
  webSearchEnabled = false,
  imageGenerationEnabled = false,
  canvasEnabled = false,
  imageAspectRatio = 'auto',
  placeholder = 'Message to Benthos',
  maxTextareaHeight = 192,
  onChange,
  onSubmit,
  onStop,
  onToggleWebSearch,
  onToggleImageGeneration,
  onToggleCanvas,
  onImageAspectRatioChange,
  onFilesUpload,
  onAttachRecentFile,
  onRemoveFile,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const composerBodyRef = useRef<HTMLDivElement>(null);
  const limitCardRef = useRef<HTMLDivElement>(null);
  const { isGuest } = useGuestStatus();
  const activeLimit = useActiveLimit(isGuest);
  const isLimited = Boolean(activeLimit);
  const [limitTick, setLimitTick] = useState(() => Date.now());

  useEffect(() => {
    if (!activeLimit) return;
    setLimitTick(Date.now());
    const interval = window.setInterval(() => {
      setLimitTick(Date.now());
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [activeLimit]);

  useEffect(() => {
    const el = limitCardRef.current;
    if (!el || !isLimited || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 10, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.34, ease: 'power3.out', clearProps: 'transform' }
      );
    }, limitCardRef);
    return () => ctx.revert();
  }, [isLimited]);
  const gridRef = useRef<HTMLDivElement>(null);
  const compactTextSlotRef = useRef<HTMLDivElement>(null);
  const expandedTextSlotRef = useRef<HTMLDivElement>(null);
  const attachmentsWrapRef = useRef<HTMLDivElement>(null);
  const attachmentsRowRef = useRef<HTMLDivElement>(null);
  const plusIconRef = useRef<HTMLSpanElement>(null);
  const sendArrowRef = useRef<HTMLSpanElement>(null);

  const dragDepthRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const liveTranscribeTimerRef = useRef<number | null>(null);
  const liveTranscribeAbortRef = useRef<AbortController | null>(null);
  const liveTranscribeInFlightRef = useRef(false);
  const lastTranscribedChunkCountRef = useRef(0);
  const dictationBaseRef = useRef('');
  const toggleDictationRef = useRef<() => void>(() => {});
  const [dictationStream, setDictationStream] = useState<MediaStream | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const gridProxyRef = useRef({ r1: 0, r2: 44, gap: 0, minH: 44 });
  const prevSlotRef = useRef<TextareaSlot | null>(null);
  const prevHeightRef = useRef<number>(38);
  const prevModeRef = useRef<boolean>(false);
  const hasLayoutInitRef = useRef(false);

  const prevHasAttachmentsRef = useRef(false);
  const hasAttachmentsInitRef = useRef(false);
  const prevAttachmentKeysRef = useRef<string[]>([]);

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationActivityTick, setDictationActivityTick] = useState(0);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isAttachMenuRendered, setIsAttachMenuRendered] = useState(false);
  const [isDictationEnabled, setIsDictationEnabled] = useState(
    () => loadGeneralSettings().dictationEnabled
  );
  const [sendMessageKey, setSendMessageKey] = useState(
    () => loadGeneralSettings().sendMessageKey
  );
  const { data: recentFiles = [] } = useQuery<ComposerRecentFile[]>({
    queryKey: deepchatQueryKeys.recentFiles,
    queryFn: getComposerRecentFiles,
  });
  const [previewFile, setPreviewFile] = useState<ComposerFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const shortcuts = useShortcutLabels();
  const canSubmit = value.trim().length > 0 || attachedFiles.length > 0;
  const hasText = value.trim().length > 0;
  const hasAttachedFiles = attachedFiles.length > 0;
  const isToolComposerActive = webSearchEnabled || imageGenerationEnabled || canvasEnabled;
  const activePreviewFile =
    previewFile &&
    attachedFiles.some(
      (file) => file.name === previewFile.name && file.ext === previewFile.ext
    )
      ? previewFile
      : null;

  const applyGridStyle = useCallback(() => {
    const gridEl = gridRef.current;
    if (!gridEl) return;
    const p = gridProxyRef.current;
    gridEl.style.gridTemplateRows = `${p.r1.toFixed(2)}px ${p.r2.toFixed(2)}px`;
    gridEl.style.rowGap = `${p.gap.toFixed(2)}px`;
    gridEl.style.minHeight = `${p.minH.toFixed(2)}px`;
  }, []);

  // Synced GSAP layout transition for the composer grid and textarea geometry
  const syncComposerGeometry = useCallback(
    (allowAnimate: boolean) => {
      const bodyEl = composerBodyRef.current;
      const gridEl = gridRef.current;
      const textareaEl = textareaRef.current;
      const targetSlotEl = isToolComposerActive
        ? expandedTextSlotRef.current
        : compactTextSlotRef.current;
      if (!bodyEl || !gridEl || !textareaEl || !targetSlotEl) return;

      const bodyRect = bodyEl.getBoundingClientRect();
      const gridRect = gridEl.getBoundingClientRect();
      const targetRect = targetSlotEl.getBoundingClientRect();
      if (targetRect.width <= 0) return;

      // Measure the damn textarea height at its target width so it doesn't jump around
      const prevWidth = textareaEl.style.width;
      const prevHeight = textareaEl.style.height;
      textareaEl.style.width = `${targetRect.width}px`;
      textareaEl.style.height = 'auto';
      const nextHeight = Math.min(Math.max(textareaEl.scrollHeight, 38), maxTextareaHeight);
      textareaEl.style.width = prevWidth;
      textareaEl.style.height = prevHeight;

      const rowHeight = Math.max(44, nextHeight);
      const nextLeft = targetRect.left - bodyRect.left;
      const nextTop =
        gridRect.top - bodyRect.top + Math.max(0, (rowHeight - nextHeight) / 2);
      const nextSlot: TextareaSlot = {
        left: nextLeft,
        top: nextTop,
        width: targetRect.width,
        minHeight: rowHeight,
      };

      const targetR1 = isToolComposerActive ? rowHeight : 0;
      const targetR2 = isToolComposerActive ? 44 : rowHeight;
      const targetGap = isToolComposerActive ? 8 : 0;
      const targetMinH = isToolComposerActive ? rowHeight + 52 : rowHeight;

      const modeChanged = prevModeRef.current !== isToolComposerActive;
      const heightChanged = Math.abs(prevHeightRef.current - nextHeight) > 0.5;
      const slotChanged =
        !prevSlotRef.current ||
        Math.abs(prevSlotRef.current.left - nextSlot.left) > 0.5 ||
        Math.abs(prevSlotRef.current.top - nextSlot.top) > 0.5 ||
        Math.abs(prevSlotRef.current.width - nextSlot.width) > 0.5;

      if (hasLayoutInitRef.current && !modeChanged && !heightChanged && !slotChanged) {
        return;
      }

      const reduce = prefersReducedMotion() || !allowAnimate;

      if (!hasLayoutInitRef.current || reduce) {
        hasLayoutInitRef.current = true;
        prevSlotRef.current = nextSlot;
        prevHeightRef.current = nextHeight;
        prevModeRef.current = isToolComposerActive;

        gsap.killTweensOf([textareaEl, gridProxyRef.current]);
        gridProxyRef.current.r1 = targetR1;
        gridProxyRef.current.r2 = targetR2;
        gridProxyRef.current.gap = targetGap;
        gridProxyRef.current.minH = targetMinH;
        applyGridStyle();
        gsap.set(textareaEl, {
          left: nextSlot.left,
          top: nextSlot.top,
          width: nextSlot.width,
          height: nextHeight,
          opacity: 1,
        });
        return;
      }

      prevSlotRef.current = nextSlot;
      prevHeightRef.current = nextHeight;
      prevModeRef.current = isToolComposerActive;

      if (modeChanged || heightChanged) {
        const duration = modeChanged ? 0.34 : 0.2;
        const ease = modeChanged ? 'expo.out' : 'power3.out';

        gsap.to(gridProxyRef.current, {
          r1: targetR1,
          r2: targetR2,
          gap: targetGap,
          minH: targetMinH,
          duration,
          ease,
          overwrite: 'auto',
          onUpdate: applyGridStyle,
        });

        gsap.to(textareaEl, {
          left: nextSlot.left,
          top: nextSlot.top,
          width: nextSlot.width,
          height: nextHeight,
          opacity: 1,
          duration,
          ease,
          overwrite: 'auto',
        });
      } else {
        // Just a viewport or sibling width change, snap it right away without sluggish tweening
        gridProxyRef.current.r1 = targetR1;
        gridProxyRef.current.r2 = targetR2;
        gridProxyRef.current.gap = targetGap;
        gridProxyRef.current.minH = targetMinH;
        applyGridStyle();
        gsap.set(textareaEl, {
          left: nextSlot.left,
          top: nextSlot.top,
          width: nextSlot.width,
          height: nextHeight,
          opacity: 1,
        });
      }
    },
    [applyGridStyle, isToolComposerActive, maxTextareaHeight]
  );

  useLayoutEffect(() => {
    syncComposerGeometry(true);
  }, [
    syncComposerGeometry,
    value,
    webSearchEnabled,
    imageGenerationEnabled,
    canvasEnabled,
    imageAspectRatio,
    attachedFiles.length,
  ]);

  useEffect(() => {
    let frame = 0;
    const scheduleSync = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        syncComposerGeometry(false);
      });
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleSync) : null;
    if (resizeObserver) {
      if (composerBodyRef.current) resizeObserver.observe(composerBodyRef.current);
      if (compactTextSlotRef.current) resizeObserver.observe(compactTextSlotRef.current);
      if (expandedTextSlotRef.current) resizeObserver.observe(expandedTextSlotRef.current);
    }
    window.addEventListener('resize', scheduleSync);

    const rafId = window.requestAnimationFrame(() => syncComposerGeometry(false));
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleSync);
      if (frame) window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(rafId);
    };
  }, [syncComposerGeometry]);

  // GSAP drawer slide-open and item entrance for attached files
  useLayoutEffect(() => {
    const wrapEl = attachmentsWrapRef.current;
    if (!wrapEl) return;
    const reduce = prefersReducedMotion();

    if (!hasAttachmentsInitRef.current) {
      hasAttachmentsInitRef.current = true;
      prevHasAttachmentsRef.current = hasAttachedFiles;
      if (hasAttachedFiles) {
        gsap.set(wrapEl, {
          height: 'auto',
          opacity: 1,
          y: 0,
          overflow: 'visible',
          pointerEvents: 'auto',
        });
      } else {
        gsap.set(wrapEl, {
          height: 0,
          opacity: 0,
          y: -4,
          overflow: 'hidden',
          pointerEvents: 'none',
        });
      }
      return;
    }

    if (prevHasAttachmentsRef.current === hasAttachedFiles) return;
    prevHasAttachmentsRef.current = hasAttachedFiles;
    gsap.killTweensOf(wrapEl);

    if (hasAttachedFiles) {
      gsap.set(wrapEl, { height: 'auto', overflow: 'hidden', pointerEvents: 'auto' });
      const targetHeight = wrapEl.scrollHeight;
      gsap.fromTo(
        wrapEl,
        { height: 0, opacity: 0, y: reduce ? 0 : -4 },
        {
          height: targetHeight,
          opacity: 1,
          y: 0,
          duration: reduce ? 0.01 : 0.28,
          ease: 'expo.out',
          onComplete: () => {
            gsap.set(wrapEl, { height: 'auto', overflow: 'visible', clearProps: 'transform' });
          },
        }
      );
    } else {
      const currentHeight = wrapEl.offsetHeight;
      gsap.set(wrapEl, { height: currentHeight, overflow: 'hidden', pointerEvents: 'none' });
      gsap.to(wrapEl, {
        height: 0,
        opacity: 0,
        y: reduce ? 0 : -4,
        duration: reduce ? 0.01 : 0.2,
        ease: 'power2.in',
      });
    }
  }, [hasAttachedFiles]);

  // Pop-in animation for each newly added attachment card
  useEffect(() => {
    const currentKeys = attachedFiles.map((file, idx) => `${file.name}::${file.ext}::${idx}`);
    const prevKeys = prevAttachmentKeysRef.current;
    prevAttachmentKeysRef.current = currentKeys;

    const rowEl = attachmentsRowRef.current;
    if (!rowEl || prefersReducedMotion() || attachedFiles.length === 0) return;

    const itemEls = rowEl.querySelectorAll<HTMLElement>('.dc-attach-item');
    itemEls.forEach((el, idx) => {
      const key = currentKeys[idx];
      if (!prevKeys.includes(key)) {
        gsap.fromTo(
          el,
          { opacity: 0, y: 8, scale: 0.9 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.28,
            ease: 'back.out(1.7)',
            clearProps: 'transform,opacity',
          }
        );
      }
    });
  }, [attachedFiles]);

  // Spin the `+` button 45deg into an X when the menu opens
  useEffect(() => {
    const iconEl = plusIconRef.current;
    if (!iconEl) return;
    const reduce = prefersReducedMotion();
    gsap.to(iconEl, {
      rotation: isAttachMenuOpen ? 45 : 0,
      duration: reduce ? 0.01 : 0.3,
      ease: 'back.out(1.8)',
      overwrite: 'auto',
    });
  }, [isAttachMenuOpen]);

  // Rotate and scale the Send arrow when there's actually text ready to fire
  useEffect(() => {
    const arrowEl = sendArrowRef.current;
    if (!arrowEl) return;
    const reduce = prefersReducedMotion();
    gsap.to(arrowEl, {
      rotation: hasText ? 0 : 90,
      y: hasText ? -0.5 : 0,
      scale: hasText ? 1 : 0.96,
      duration: reduce ? 0.01 : 0.26,
      ease: 'expo.out',
      overwrite: 'auto',
    });
  }, [hasText, isBusy]);

  // Slight scale bump on file dragover, clears transform when dropped
  useEffect(() => {
    const formEl = composerRef.current;
    if (!formEl || prefersReducedMotion()) return;
    if (isDraggingFile) {
      gsap.to(formEl, {
        scale: 1.006,
        duration: 0.22,
        ease: 'power2.out',
        overwrite: 'auto',
      });
    } else {
      gsap.to(formEl, {
        scale: 1,
        duration: 0.22,
        ease: 'power2.out',
        clearProps: 'transform',
        overwrite: 'auto',
      });
    }
  }, [isDraggingFile]);

  useEffect(() => {
    if (!isToolComposerActive) return;
    textareaRef.current?.focus();
  }, [isToolComposerActive]);

  useEffect(() => {
    const unsubscribe = subscribeGeneralSettings((settings) => {
      setIsDictationEnabled(settings.dictationEnabled);
      setSendMessageKey(settings.sendMessageKey);
      if (!settings.dictationEnabled) {
        recognitionRef.current?.abort();
        recognitionRef.current = null;
        setIsDictating(false);
      }
    });
    return () => {
      recognitionRef.current?.abort();
      if (liveTranscribeTimerRef.current !== null) {
        window.clearInterval(liveTranscribeTimerRef.current);
      }
      liveTranscribeAbortRef.current?.abort();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAttachMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (composerRef.current && !composerRef.current.contains(event.target as Node)) {
        setIsAttachMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAttachMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAttachMenuOpen]);

  useEffect(() => {
    const closeAttachMenu = () => setIsAttachMenuOpen(false);
    window.addEventListener('modelSelectorOpened', closeAttachMenu);
    return () => window.removeEventListener('modelSelectorOpened', closeAttachMenu);
  }, []);

  const submit = () => {
    if (isLimited || !canSubmit || isBusy || isUploading) return;
    onSubmit(value);
  };

  const uploadFiles = (files: File[]) => {
    const validFiles = files.filter((file) => file.size > 0);
    if (validFiles.length > 0) onFilesUpload(validFiles);
  };

  const openFilePicker = useCallback(() => {
    if (isUploading) return;
    fileInputRef.current?.click();
    setIsAttachMenuOpen(false);
  }, [isUploading]);

  const toggleAttachMenu = () => {
    const nextOpen = !isAttachMenuOpen;
    if (nextOpen) {
      setIsAttachMenuRendered(true);
      window.dispatchEvent(new Event('closeModelSelector'));
    }
    setIsAttachMenuOpen(nextOpen);
  };

  useEffect(() => {
    const handleUploadShortcut = (event: KeyboardEvent) => {
      if (!isShortcutEvent(event, 'uploadFile')) return;
      event.preventDefault();
      event.stopPropagation();
      openFilePicker();
    };
    window.addEventListener('keydown', handleUploadShortcut, true);
    return () => window.removeEventListener('keydown', handleUploadShortcut, true);
  }, [openFilePicker]);

  const transcribeSnapshot = useCallback(
    async (chunks: Blob[], mimeType: string, isFinal: boolean) => {
      if (chunks.length === 0) return;
      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
      if (blob.size < 400) return;

      if (!isFinal && liveTranscribeInFlightRef.current) return;
      if (isFinal) {
        liveTranscribeAbortRef.current?.abort();
      }

      const controller = new AbortController();
      liveTranscribeAbortRef.current = controller;
      liveTranscribeInFlightRef.current = true;
      if (isFinal) setIsTranscribing(true);

      try {
        const settings = loadGeneralSettings();
        const ext = mimeType.includes('mp4')
          ? 'm4a'
          : mimeType.includes('ogg')
            ? 'ogg'
            : 'webm';
        const form = new FormData();
        form.append('audio', blob, `dictation.${ext}`);
        form.append('lang', getDictationLanguage(settings));
        const res = await fetch('/api/chat/transcribe', {
          method: 'POST',
          credentials: 'same-origin',
          signal: controller.signal,
          body: form,
        });
        if (!res.ok) {
          if (isFinal) throw new Error('Transcription failed');
          return;
        }
        const data = (await res.json()) as { text?: string };
        const spokenText = (data.text || '').trim();
        if (spokenText) {
          const base = dictationBaseRef.current.trimEnd();
          onChange(base ? `${base} ${spokenText}` : spokenText);
        }
      } catch (err) {
        if (isFinal && !(err instanceof Error && err.name === 'AbortError')) {
          toast.error('Could not transcribe audio.');
        }
      } finally {
        liveTranscribeInFlightRef.current = false;
        if (isFinal) setIsTranscribing(false);
      }
    },
    [onChange]
  );

  const stopMediaRecorderDictation = useCallback(() => {
    if (liveTranscribeTimerRef.current !== null) {
      window.clearInterval(liveTranscribeTimerRef.current);
      liveTranscribeTimerRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      setDictationStream(null);
      setIsDictating(false);
    }
  }, []);

  const startMediaRecorderDictation = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Voice dictation is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeCandidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const preferredMime =
        mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      lastTranscribedChunkCountRef.current = 0;
      dictationBaseRef.current = value;
      setDictationStream(stream);
      setIsDictating(true);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      // Poll and transcribe chunks every ~2.2s while speaking so you don't have to hit stop first
      if (liveTranscribeTimerRef.current !== null) {
        window.clearInterval(liveTranscribeTimerRef.current);
      }
      liveTranscribeTimerRef.current = window.setInterval(() => {
        if (
          audioChunksRef.current.length > lastTranscribedChunkCountRef.current &&
          !liveTranscribeInFlightRef.current
        ) {
          lastTranscribedChunkCountRef.current = audioChunksRef.current.length;
          void transcribeSnapshot(
            [...audioChunksRef.current],
            recorder.mimeType || preferredMime || 'audio/webm',
            false
          );
        }
      }, 2200);

      recorder.onstop = async () => {
        if (liveTranscribeTimerRef.current !== null) {
          window.clearInterval(liveTranscribeTimerRef.current);
          liveTranscribeTimerRef.current = null;
        }
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        lastTranscribedChunkCountRef.current = 0;
        mediaRecorderRef.current = null;
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
        setDictationStream(null);
        setIsDictating(false);

        await transcribeSnapshot(
          chunks,
          recorder.mimeType || preferredMime || 'audio/webm',
          true
        );
      };

      recorder.start(300);
    } catch {
      if (liveTranscribeTimerRef.current !== null) {
        window.clearInterval(liveTranscribeTimerRef.current);
        liveTranscribeTimerRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      setDictationStream(null);
      setIsDictating(false);
      toast.error('Microphone permission denied.');
    }
  }, [transcribeSnapshot, value]);

  const toggleDictation = () => {
    if (!isDictationEnabled || isTranscribing) return;
    if (isDictating) {
      if (mediaRecorderRef.current) {
        stopMediaRecorderDictation();
        return;
      }
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setIsDictating(false);
      return;
    }
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      void startMediaRecorderDictation();
      return;
    }
    const recognition = new Recognition();
    const settings = loadGeneralSettings();
    let receivedResult = false;
    dictationBaseRef.current = value;
    recognition.lang = getDictationLanguage(settings);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      receivedResult = true;
      let finalTranscript = '';
      let interimTranscript = '';
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript || '';
        if (result?.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      const base = dictationBaseRef.current.trimEnd();
      const spokenText = `${finalTranscript}${interimTranscript}`.trimStart();
      onChange(spokenText ? `${base}${base ? ' ' : ''}${spokenText}` : base);
      setDictationActivityTick((t) => t + 1);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      if (!mediaRecorderRef.current) {
        setIsDictating(false);
      }
    };
    recognition.onerror = (event?: { error?: string }) => {
      const code = event?.error;
      recognitionRef.current = null;
      setIsDictating(false);
      if (code === 'service-not-allowed' || (!receivedResult && code === 'network')) {
        // Browser blocks built-in cloud speech (Brave, Linux Chromium, etc.), fall back to free server transcription
        void startMediaRecorderDictation();
        return;
      }
      if (code === 'not-allowed') {
        toast.error('Microphone permission denied.');
      } else if (code === 'audio-capture') {
        toast.error('No microphone detected.');
      }
    };
    recognitionRef.current = recognition;
    setIsDictating(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsDictating(false);
      void startMediaRecorderDictation();
    }
  };

  useEffect(() => {
    toggleDictationRef.current = toggleDictation;
  });

  useEffect(() => {
    const handleComposerShortcut = (event: KeyboardEvent) => {
      if (isShortcutEvent(event, 'selectModel')) {
        event.preventDefault();
        event.stopPropagation();
        setIsAttachMenuOpen(false);
        window.dispatchEvent(new Event('openModelSelector'));
        return;
      }
      if (isShortcutEvent(event, 'dictation')) {
        event.preventDefault();
        event.stopPropagation();
        toggleDictationRef.current();
      }
    };
    window.addEventListener('keydown', handleComposerShortcut, true);
    return () => window.removeEventListener('keydown', handleComposerShortcut, true);
  }, []);

  const getClipboardFiles = (clipboardData: DataTransfer) => {
    const files: File[] = [];

    for (let index = 0; index < clipboardData.items.length; index += 1) {
      const item = clipboardData.items[index];
      if (item.kind !== 'file') continue;
      const file = item.getAsFile();
      if (!file) continue;
      if (file.name) {
        files.push(file);
      } else {
        const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
        files.push(
          new File([file], `pasted-image-${Date.now()}-${index}.${ext}`, {
            type: file.type || 'image/png',
            lastModified: Date.now(),
          })
        );
      }
    }

    if (files.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
      for (let index = 0; index < clipboardData.files.length; index += 1) {
        const file = clipboardData.files[index];
        if (file) files.push(file);
      }
    }

    return files;
  };

  const extractPastedImageSource = (clipboardData: DataTransfer): string | null => {
    const html = clipboardData.getData('text/html') || '';
    const plain = (clipboardData.getData('text/plain') || '').trim();

    if (html) {
      const imgMatch = html.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
      if (imgMatch?.[1] && (!plain || /^https?:\/\/\S+$/i.test(plain))) {
        return imgMatch[1].replace(/&amp;/g, '&');
      }
    }

    if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(plain)) {
      return plain;
    }

    if (/^https?:\/\/\S+\.(png|jpe?g|webp|gif|bmp|avif|tiff?|ico)(\?\S*)?$/i.test(plain)) {
      return plain;
    }

    return null;
  };

  const fetchPastedImageAsFile = async (src: string): Promise<File | null> => {
    const urls = src.startsWith('data:image/')
      ? [src]
      : [src, `/api/storage/file?imageUrl=${encodeURIComponent(src)}`];

    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const blob = await res.blob();
        if (!blob.size || (blob.type && !blob.type.startsWith('image/'))) continue;
        const mime = blob.type || 'image/png';
        const ext = mime.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') || 'png';
        return new File([blob], `pasted-image-${Date.now()}.${ext}`, {
          type: mime,
          lastModified: Date.now(),
        });
      } catch {
        // Fallback to same-origin proxy on CORS failure
      }
    }
    return null;
  };

  const toolsButton = (
    <div className="relative flex h-10 shrink-0 items-center justify-center sm:h-11">
      <input
        type="file"
        multiple
        ref={fileInputRef}
        className="hidden"
        onChange={(event) => {
          uploadFiles(Array.from(event.target.files || []));
          event.target.value = '';
        }}
      />
      <Tooltip
        label="Add Files and more"
        shortcuts={[{ label: '/', tone: 'key' }]}
        side="bottom"
        align="start"
        disabled={isAttachMenuOpen}
      >
        <button
          type="button"
          disabled={isUploading}
          onClick={toggleAttachMenu}
          className={`flex h-[35px] w-[35px] items-center justify-center rounded-full transition-all duration-150 active:scale-90 disabled:cursor-not-allowed disabled:opacity-50 ${
            isAttachMenuOpen
              ? 'bg-black/[0.08] text-[var(--dc-text-strong)] dark:bg-white/[0.12]'
              : 'text-[var(--dc-text)] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
          }`}
          aria-label="Open tools menu"
          aria-expanded={isAttachMenuOpen}
        >
          <span ref={plusIconRef} className="flex items-center justify-center">
            <Plus className="h-[22px] w-[22px] text-[var(--dc-text)]" strokeWidth={2.5} />
          </span>
        </button>
      </Tooltip>

      {isAttachMenuRendered && (
        <ComposerToolsMenu
          isOpen={isAttachMenuOpen}
          onExited={() => setIsAttachMenuRendered(false)}
          isUploading={isUploading}
          webSearchEnabled={webSearchEnabled}
          imageGenerationEnabled={imageGenerationEnabled}
          canvasEnabled={canvasEnabled}
          imageAspectRatio={imageAspectRatio}
          uploadShortcut={shortcuts.uploadFile}
          recentFiles={recentFiles}
          onUpload={openFilePicker}
          onAttachRecentFile={(file) => {
            onAttachRecentFile(file);
            setIsAttachMenuOpen(false);
          }}
          onToggleWebSearch={(enabled) => {
            setIsAttachMenuOpen(false);
            onToggleWebSearch?.(enabled);
          }}
          onToggleImageGeneration={(enabled) => {
            setIsAttachMenuOpen(false);
            onToggleImageGeneration?.(enabled);
          }}
          onToggleCanvas={(enabled) => {
            setIsAttachMenuOpen(false);
            onToggleCanvas?.(enabled);
          }}
          onImageAspectRatioChange={onImageAspectRatioChange}
          onClose={() => setIsAttachMenuOpen(false)}
          getFileIcon={getComposerFileIcon}
          getDisplayName={getComposerDisplayName}
        />
      )}
    </div>
  );

  const searchToolBadge = (
    <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
      <SearchToolBadge enabled={webSearchEnabled} onDisable={() => onToggleWebSearch?.(false)} />
      <CanvasToolBadge enabled={canvasEnabled} onDisable={() => onToggleCanvas?.(false)} />
      <ImageToolBadge
        enabled={imageGenerationEnabled}
        aspectRatio={imageAspectRatio}
        onDisable={() => onToggleImageGeneration?.(false)}
        onAspectRatioChange={onImageAspectRatioChange}
      />
    </div>
  );

  const actionControls = (
    <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
      <div className="hidden min-w-0 sm:block sm:max-w-[15rem] lg:max-w-[16rem]">
        <ModelSelector desktopOnly variant="ghost" />
      </div>
      {isDictationEnabled && (
        <div className="hidden sm:block">
          <IconButton
            label={isDictating ? 'Stop dictation' : 'Dictate'}
            tooltip={isDictating ? 'Stop dictation' : 'Dictate'}
            shortcut={shortcuts.dictation.join('+')}
            onClick={toggleDictation}
          >
            <DictateAbstractOrb
              isDictating={isDictating || isTranscribing}
              activityTick={dictationActivityTick}
              mediaStream={dictationStream}
              className="h-5 w-5"
            />
          </IconButton>
        </div>
      )}
      {isDictationEnabled && (isDictating || isTranscribing || (!hasText && !hasAttachedFiles && !isBusy)) && (
        <button
          type="button"
          onClick={toggleDictation}
          aria-label={isDictating ? 'Stop dictation' : 'Dictate'}
          aria-pressed={isDictating}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-90 sm:hidden ${
            isDictating || isTranscribing
              ? 'bg-blue-500/12 text-blue-600 ring-1 ring-blue-500/30 dark:text-blue-400'
              : 'text-[var(--dc-text-body)] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]'
          }`}
        >
          <DictateAbstractOrb
            isDictating={isDictating || isTranscribing}
            activityTick={dictationActivityTick}
            mediaStream={dictationStream}
            className="h-[19px] w-[19px]"
          />
        </button>
      )}
      <Tooltip
        label={isBusy ? 'Stop generating' : 'Send prompt'}
        shortcuts={
          isBusy
            ? []
            : [{ label: <CornerDownLeft className="h-3.5 w-3.5" strokeWidth={2.4} />, tone: 'icon' }]
        }
        side="bottom"
        align="end"
      >
        <button
          type={isBusy ? 'button' : 'submit'}
          disabled={isUploading || (!isBusy && !canSubmit)}
          onClick={isBusy ? onStop : undefined}
          className={`flex h-[35px] w-[35px] items-center justify-center rounded-full transition-all duration-200 disabled:cursor-not-allowed ${
            isBusy
              ? 'bg-red-500 text-white shadow-md shadow-red-500/30 hover:bg-red-600'
              : 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-600/40 active:scale-95 disabled:opacity-40 disabled:shadow-none'
          }`}
          aria-label={isBusy ? 'Stop generating' : 'Send message'}
        >
          {isBusy ? (
            <Square className="h-3.5 w-3.5 fill-white text-white" strokeWidth={2} />
          ) : (
            <span
              ref={sendArrowRef}
              className="flex h-[18px] w-[18px] items-center justify-center"
            >
              <ArrowUp className="h-[18px] w-[18px] text-current" strokeWidth={2.5} />
            </span>
          )}
        </button>
      </Tooltip>
    </div>
  );

  return (
    <div className="flex w-full flex-col gap-2">
      {activeLimit && (
        <div
          ref={limitCardRef}
          role="status"
          aria-live="polite"
          className="flex flex-col gap-2.5 rounded-2xl border border-amber-500/25 bg-[var(--dc-panel)] px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-2.5 sm:items-center">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/12 text-amber-600 dark:text-amber-400 sm:mt-0">
              <AlertCircle className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--dc-text-strong)] sm:text-[13px]">
                {activeLimit.reason === 'guest'
                  ? "You've reached the guest message limit"
                  : "You've reached your usage limit"}
              </p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--dc-text-muted)] sm:text-xs">
                {activeLimit.reason === 'guest'
                  ? `Resets in ${formatRemainingTime(activeLimit.resetAt, limitTick)}. Sign in to continue chatting.`
                  : `Your usage window resets in ${formatRemainingTime(activeLimit.resetAt, limitTick)}. Please try again later.`}
              </p>
            </div>
          </div>

          {activeLimit.reason === 'guest' && (
            <button
              type="button"
              onClick={openAuthModal}
              className="inline-flex shrink-0 items-center justify-center self-start rounded-full bg-[var(--dc-invert)] px-3.5 py-1.5 text-xs font-medium text-[var(--dc-text-on-invert)] transition-colors hover:bg-[var(--dc-invert-hover)] sm:self-center"
            >
              Sign in
            </button>
          )}
        </div>
      )}

      <form
        ref={composerRef}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepthRef.current += 1;
          if (Array.from(event.dataTransfer.types).includes('Files')) setIsDraggingFile(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setIsDraggingFile(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepthRef.current = 0;
          setIsDraggingFile(false);
          uploadFiles(Array.from(event.dataTransfer.files));
        }}
        onPaste={(event) => {
          const files = getClipboardFiles(event.clipboardData);
          if (files.length > 0) {
            event.preventDefault();
            uploadFiles(files);
            return;
          }
          const pastedImgSrc = extractPastedImageSource(event.clipboardData);
          if (pastedImgSrc) {
            event.preventDefault();
            void fetchPastedImageAsFile(pastedImgSrc).then((file) => {
              if (file) uploadFiles([file]);
            });
          }
        }}
        className={`dc-composer-shell relative rounded-[26px] border border-[var(--dc-border)] bg-[var(--dc-surface)] shadow-none dark:border-white/[0.1] dark:bg-[var(--dc-surface-input)] ${
          isToolComposerActive ? 'px-4 py-3 sm:px-5 sm:py-3.5' : 'px-2 py-1'
        } ${isDraggingFile ? 'ring-2 ring-indigo-400 dark:ring-indigo-500/40' : ''}`}
      >
        {/* Attachment strip with extra padding so the little X badge doesn't get clipped */}
        <div
          ref={attachmentsWrapRef}
          aria-hidden={!hasAttachedFiles}
          className="w-full"
        >
          {hasAttachedFiles && (
            <div
              ref={attachmentsRowRef}
              className="custom-scrollbar flex items-center gap-2.5 overflow-x-auto px-2.5 pb-2 pt-2.5 after:block after:w-1 after:shrink-0 after:content-['']"
            >
              {attachedFiles.map((file, index) => {
                const isImageThumb =
                  isComposerImageFile(file) && Boolean(file.previewUrl || file.dataUrl);
                const thumbSrc = file.previewUrl || file.dataUrl;
                const displayName = getComposerDisplayName(file.name);
                const sizeLabel = formatComposerFileSize(file.size);
                const extLabel = (file.ext || 'file').toUpperCase();
                const metaLabel = sizeLabel ? `${extLabel} · ${sizeLabel}` : extLabel;

                return (
                  <div
                    key={`${file.name}-${file.ext}-${index}`}
                    className="dc-attach-item group/attachment relative shrink-0"
                  >
                    {isImageThumb && thumbSrc ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewFile(file);
                          setIsPreviewOpen(true);
                        }}
                        className="dc-attach-card flex h-12 w-12 cursor-zoom-in items-center justify-center overflow-hidden rounded-[14px] active:scale-95"
                        aria-label={`Preview ${displayName}`}
                      >
                        <NextImage
                          src={thumbSrc}
                          alt={displayName}
                          width={48}
                          height={48}
                          unoptimized
                          className="h-full w-full object-cover transition-transform duration-200 group-hover/attachment:scale-105"
                        />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewFile(file);
                          setIsPreviewOpen(true);
                        }}
                        className="dc-attach-card flex h-12 max-w-[180px] cursor-pointer items-center gap-2.5 rounded-[14px] px-2 pr-3 text-left active:scale-[0.97] sm:max-w-[216px]"
                        aria-label={`Preview ${displayName}`}
                      >
                        {file.ext?.toLowerCase() === 'pdf' && thumbSrc ? (
                          <span className="flex h-9 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-slate-200/80 bg-white dark:border-slate-700/80 dark:bg-slate-900">
                            <PdfCoverThumbnail src={thumbSrc} alt={displayName} />
                          </span>
                        ) : (
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${getComposerFileTone(
                              file.ext
                            )}`}
                          >
                            {getComposerFileIcon(file.ext, 'h-4 w-4')}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold leading-tight text-[var(--dc-text-strong)]">
                            {displayName}
                          </span>
                          <span className="mt-0.5 block truncate text-[10.5px] font-medium leading-none text-[var(--dc-text-muted)]">
                            {metaLabel}
                          </span>
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveFile(index);
                      }}
                      className="dc-attach-remove absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full opacity-100 shadow-sm transition-all duration-150 hover:scale-110 active:scale-95 sm:opacity-0 sm:group-hover/attachment:opacity-100 sm:group-focus-within/attachment:opacity-100"
                      aria-label={`Remove ${displayName}`}
                    >
                      <X className="h-3 w-3" strokeWidth={2.75} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Relative wrapper keeping controls and textarea isolated from attachment drawer height changes */}
        <div ref={composerBodyRef} className="relative">
          <div
            ref={gridRef}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-0.5 overflow-visible sm:gap-x-2"
          >
            <div className="relative z-30 col-start-1 row-start-2 flex min-w-0 items-center">
              {toolsButton}
            </div>
            <div className="col-start-2 row-start-2 flex min-w-0 items-center">
              {searchToolBadge}
            </div>
            <div
              ref={expandedTextSlotRef}
              className="pointer-events-none invisible col-start-1 col-end-4 row-start-1 min-w-0"
              aria-hidden="true"
            />
            <div
              ref={compactTextSlotRef}
              className="pointer-events-none invisible col-start-2 col-end-3 row-start-2 min-w-0"
              aria-hidden="true"
            />
            <div className="relative z-30 col-start-3 row-start-2 flex items-center justify-end">
              {actionControls}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            disabled={isLimited}
            placeholder={
              isLimited
                ? 'Messaging is paused until your limit resets'
                : placeholder
            }
            className={`custom-scrollbar absolute left-0 top-0 z-20 w-full resize-none bg-transparent text-[16px] font-medium leading-snug text-[var(--dc-text-strong)] outline-none placeholder:text-[var(--dc-text-placeholder)] ${
              isToolComposerActive ? 'px-0 py-2' : 'px-1 py-2'
            } ${isLimited ? 'cursor-not-allowed opacity-60' : ''}`}
            style={{ maxHeight: maxTextareaHeight, opacity: 0 }}
            rows={1}
            value={value}
            onChange={(event) => {
              if (!isLimited) onChange(event.target.value);
            }}
            onKeyDown={(event) => {
              const shouldSend = sendMessageKey === 'mod-enter'
                ? event.key === 'Enter' && (event.ctrlKey || event.metaKey)
                : event.key === 'Enter' && !event.shiftKey;
              if (shouldSend) {
                event.preventDefault();
                submit();
              }
            }}
          />
        </div>
      </form>

      {activePreviewFile && isComposerImageFile(activePreviewFile) ? (
        <GlobalImagePreviewModal
          isOpen={isPreviewOpen}
          src={activePreviewFile.dataUrl || activePreviewFile.previewUrl || ''}
          alt={activePreviewFile.name}
          fileName={activePreviewFile.name}
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewFile(null);
          }}
        />
      ) : (
        <AttachmentPreviewModal
          isOpen={isPreviewOpen && Boolean(activePreviewFile)}
          file={activePreviewFile ?? previewFile}
          onClose={() => setIsPreviewOpen(false)}
          onExited={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}

function isComposerImageFile(file: ComposerFile) {
  return IMAGE_EXTS.has(file.ext.toLowerCase());
}

function getComposerFileTone(ext: string) {
  const normalized = ext.toLowerCase();
  if (normalized === 'pdf') {
    return 'bg-rose-500/12 text-rose-600 dark:bg-rose-500/18 dark:text-rose-300';
  }
  if (SPREADSHEET_EXTS.has(normalized)) {
    return 'bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/18 dark:text-emerald-300';
  }
  if (CODE_EXTS.has(normalized)) {
    return 'bg-indigo-500/12 text-indigo-600 dark:bg-indigo-500/18 dark:text-indigo-300';
  }
  if (DOC_EXTS.has(normalized)) {
    return 'bg-sky-500/12 text-sky-600 dark:bg-sky-500/18 dark:text-sky-300';
  }
  if (VIDEO_EXTS.has(normalized) || AUDIO_EXTS.has(normalized)) {
    return 'bg-amber-500/12 text-amber-600 dark:bg-amber-500/18 dark:text-amber-300';
  }
  return 'bg-slate-500/12 text-slate-600 dark:bg-slate-400/15 dark:text-slate-300';
}

function formatComposerFileSize(bytes?: number): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

function IconButton({
  children,
  disabled,
  label,
  tooltip = label,
  shortcut,
  active,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  tooltip?: string;
  shortcut?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Tooltip
      label={tooltip}
      shortcuts={shortcut ? [{ label: shortcut, tone: 'muted' }] : []}
      side="bottom"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`flex h-9 w-9 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10 ${
          active
            ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30'
            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-100'
        }`}
        aria-label={label}
        aria-pressed={active}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function getComposerFileIcon(ext: string, className: string) {
  const normalized = ext.toLowerCase();
  if (normalized === 'pdf') return <FileText className={className} />;
  if (VIDEO_EXTS.has(normalized)) return <Video className={className} />;
  if (AUDIO_EXTS.has(normalized)) return <Volume2 className={className} />;
  if (IMAGE_EXTS.has(normalized)) return <ImageIcon className={className} />;
  if (SPREADSHEET_EXTS.has(normalized)) return <FileSpreadsheet className={className} />;
  if (CODE_EXTS.has(normalized)) return <Code2 className={className} />;
  if (DOC_EXTS.has(normalized)) return <BookOpen className={className} />;
  return <FileIcon className={className} />;
}

export function getComposerDisplayName(name: string) {
  const cleaned = name
    .replace(/^[a-f0-9]{8}-/i, '')
    .replace(/^\d{10,14}_/, '')
    .replaceAll('_', ' ')
    .trim();
  return cleaned || name;
}
