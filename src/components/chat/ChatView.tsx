'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';
import { getChat, saveMessage, uploadFile } from '@/app/actions';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import ChatComposer, { getComposerDisplayName, getComposerFileIcon } from '@/components/ui/ChatComposer';
import AttachmentPreviewModal from '@/components/ui/AttachmentPreviewModal';
import DotRevealHeadline from '@/components/home/DotRevealHeadline';
import Tooltip from '@/components/ui/Tooltip';
import { AnimatedChatTitle } from '@/components/ui/AnimatedChatTitle';
import { prefersReducedMotion, triggerSubtleHaptic } from '@/components/mobile/gesture-utils';
import {
  ChatGenerationSnapshot,
  type ImageEditRequestPayload,
  getChatGenerationState,
  startChatGeneration,
  stopChatGeneration,
  subscribeChatGeneration
} from '@/lib/ai/chat-generation';
import { formatClarificationAnswer, isGeneratedClarificationAnswerContent, parseAgentClarification, type AgentClarification, type AgentClarificationAnswer, type AgentClarificationOption } from '@/lib/agent/agent-clarification';
import { DISLIKE_REASONS, ERROR_DISLIKE_REASONS, LIKE_REASONS, getFeedbackMap, getFeedbackForVersion, subscribeFeedback, submitMessageFeedback, type MessageRating } from '@/lib/feedback/message-feedback';
import { FeedbackDialog } from '@/components/chat/FeedbackDialog';
import { extractGeneratedImagesFromMarkdown, getGenerationMode, type ExtractedGeneratedImage, type GenerationMode } from '@/lib/images/image-generation';
import { normalizeImageAspectRatio, type ImageAspectRatio } from '@/lib/images/image-aspect-ratio';
import { defaultComposerToolState, loadComposerToolState, saveComposerToolState } from '@/lib/agent/composer-tool-state';
import type { SearchSource, SearchStatus, ThinkingStep } from '@/lib/search/source-display';
import { KineticThinkingDotIcon, ThinkingSection } from '@/components/chat/search/ThinkingSection';
import { SearchStatusIndicator } from '@/components/chat/search/SearchStatusIndicator';
import { SearchResultsSidebar } from '@/components/chat/search/SearchResultsSidebar';
import { StackedFavicons } from '@/components/chat/search/StackedFavicons';
import ImageGenerationStage from '@/components/chat/image-generation/ImageGenerationStage';
import GeneratedImagePreviewModal from '@/components/chat/image-generation/GeneratedImagePreviewModal';
import { type ImageStudioEditRequest, type ImageStudioMode } from '@/components/chat/image-generation/image-studio-export';
import {
  Check, CheckCircle2, ChevronDown, ChevronRight, ChevronLeft, X, Copy, RefreshCw, Edit3, ThumbsUp, ThumbsUpFill, ThumbsDown, ThumbsDownFill
} from '@/components/ui/icons';
import toast from 'react-hot-toast';

type AttachedFile = {
  name: string;
  ext: string;
  previewUrl?: string;
  dataUrl?: string;
  content?: string;
  size?: number;
};

const canPreviewUploadFile = (file: File) =>
  file.type.startsWith('image/') ||
  file.type === 'application/pdf' ||
  file.type.startsWith('video/') ||
  file.type.startsWith('audio/') ||
  /\.(png|jpe?g|gif|webp|svg|bmp|heic|heif|avif|pdf|mp4|webm|mov|mp3|wav|ogg|m4a)$/i.test(file.name);
const createAttachedPreviewUrl = (file: File) => canPreviewUploadFile(file) ? URL.createObjectURL(file) : undefined;
const revokeAttachedPreview = (file: AttachedFile) => {
  if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
};
const stripAttachedPreview = (file: AttachedFile) => ({
  name: file.name,
  ext: file.ext,
  dataUrl: file.dataUrl,
  content: file.content,
  size: file.size
});

type MessageVersion = {
  content?: string;
  reasoning?: string;
  reasoningDuration?: number;
  searchStatus?: SearchStatus;
  searchHasReasoning?: boolean;
  searchSources?: SearchSource[];
  readSources?: SearchSource[];
  thinkingSteps?: ThinkingStep[];
  clarification?: AgentClarification;
  clarificationAnswer?: AgentClarificationAnswer;
  versionIndex?: number;
  generationMode?: GenerationMode;
  isError?: boolean;
  [key: string]: unknown;
};

type ChatMessage = {
  id: string;
  role: string;
  content?: string;
  reasoning?: string;
  reasoningDuration?: number;
  searchStatus?: SearchStatus;
  searchHasReasoning?: boolean;
  searchSources?: SearchSource[];
  readSources?: SearchSource[];
  thinkingSteps?: ThinkingStep[];
  clarification?: AgentClarification;
  clarificationAnswer?: AgentClarificationAnswer;
  versions?: MessageVersion[];
  currentVersionIndex?: number;
  chatIndex?: number;
  attachedFiles?: AttachedFile[];
  webSearchEnabled?: boolean;
  imageGenerationEnabled?: boolean;
  imageAspectRatio?: ImageAspectRatio;
  createdAt?: string;
  isStreaming?: boolean;
  isError?: boolean;
  isStopped?: boolean;
  generationMode?: GenerationMode;
  memoriesSaved?: boolean;
  memoriesSavedCount?: number;
  memoryProvider?: unknown;
  memoryModel?: unknown;
  [key: string]: unknown;
};

type ChatPayload = {
  title?: string;
  messages?: ChatMessage[];
  pendingAttachedFiles?: AttachedFile[];
};

const normalizeVersions = (versions: MessageVersion[] = []) => versions.map((version, index) => ({
  ...version,
  versionIndex: typeof version?.versionIndex === 'number' ? version.versionIndex : index + 1
}));

const normalizeMessageForDisplay = (message: ChatMessage) => {
  const parsedMessage = parseAgentClarification(message.content || '');
  if (!Array.isArray(message.versions) || message.versions.length === 0) {
    const resolvedSources = message.searchSources;
    const resolvedStatus: SearchStatus = message.searchStatus ?? (resolvedSources && resolvedSources.length > 0 ? 'completed' : 'idle');
    return {
      ...message,
      content: parsedMessage.visibleContent,
      searchStatus: resolvedStatus,
      clarification: message.clarification || parsedMessage.clarification,
      isStreaming: false
    };
  }

  const versions = normalizeVersions(message.versions);
  const requestedIndex = typeof message.currentVersionIndex === 'number' && Number.isInteger(message.currentVersionIndex) ? message.currentVersionIndex : versions.length - 1;
  const currentVersionIndex = Math.min(Math.max(requestedIndex, 0), versions.length - 1);
  const currentVersion = versions[currentVersionIndex];
  const parsedVersion = parseAgentClarification(currentVersion?.content ?? message.content ?? '');
  const resolvedSources = currentVersion?.searchSources ?? message.searchSources;
  const resolvedStatus: SearchStatus =
    currentVersion?.searchStatus ??
    message.searchStatus ??
    (resolvedSources && resolvedSources.length > 0 ? 'completed' : 'idle');

  return {
    ...message,
    versions,
    currentVersionIndex,
    content: parsedVersion.visibleContent,
    reasoning: currentVersion?.reasoning ?? message.reasoning,
    reasoningDuration: currentVersion?.reasoningDuration ?? message.reasoningDuration,
    searchStatus: resolvedStatus,
    searchHasReasoning: currentVersion?.searchHasReasoning ?? message.searchHasReasoning,
    searchSources: resolvedSources,
    readSources: currentVersion?.readSources ?? message.readSources,
    thinkingSteps: currentVersion?.thinkingSteps ?? message.thinkingSteps,
    clarification: currentVersion?.clarification ?? message.clarification ?? parsedVersion.clarification,
    clarificationAnswer: currentVersion?.clarificationAnswer ?? message.clarificationAnswer,
    generationMode: currentVersion?.generationMode ?? message.generationMode,
    isStreaming: false
  };
};

const mergeGenerationSnapshot = (items: ChatMessage[], snapshot: ChatGenerationSnapshot) => items.map(m => {
  if (m.id !== snapshot.assistantMsgId) return m;
  const parsedSnapshot = parseAgentClarification(snapshot.content);

  const updated = {
    ...m,
    content: parsedSnapshot.visibleContent,
    reasoning: snapshot.reasoning,
    reasoningDuration: snapshot.reasoningDuration,
    searchStatus: snapshot.searchStatus,
    searchHasReasoning: snapshot.searchHasReasoning,
    searchSources: snapshot.searchSources,
    readSources: snapshot.readSources,
    thinkingSteps: snapshot.thinkingSteps,
    clarification: snapshot.clarification || parsedSnapshot.clarification,
    clarificationAnswer: m.clarificationAnswer,
    generationMode: snapshot.generationMode ?? m.generationMode,
    isStreaming: snapshot.isStreaming,
    isError: snapshot.isError === true,
    isStopped: snapshot.isStopped === true
  };

  if (updated.versions && updated.currentVersionIndex !== undefined) {
    updated.versions = normalizeVersions(updated.versions);
    updated.versions[updated.currentVersionIndex] = {
      ...updated.versions[updated.currentVersionIndex],
      content: parsedSnapshot.visibleContent,
      reasoning: snapshot.reasoning,
      reasoningDuration: snapshot.reasoningDuration,
      searchStatus: snapshot.searchStatus,
      searchHasReasoning: snapshot.searchHasReasoning,
      searchSources: snapshot.searchSources,
      readSources: snapshot.readSources,
      thinkingSteps: snapshot.thinkingSteps,
      clarification: snapshot.clarification || parsedSnapshot.clarification,
      clarificationAnswer: updated.versions[updated.currentVersionIndex]?.clarificationAnswer,
      generationMode: snapshot.generationMode ?? updated.versions[updated.currentVersionIndex]?.generationMode
    };
  }

  return updated;
});

const mergeActiveGeneration = (chatId: string, items: ChatMessage[]) => {
  const snapshot = getChatGenerationState(chatId);
  return snapshot ? mergeGenerationSnapshot(items, snapshot) : items;
};

const getSelectedGenerationMode = () => {
  if (typeof window === 'undefined') return undefined;
  try {
    const selected = JSON.parse(localStorage.getItem('selectedModelObj') || '{}') as { id?: string; name?: string };
    return getGenerationMode(selected.id || selected.name);
  } catch {
    return getGenerationMode(localStorage.getItem('selectedModel'));
  }
};

export default function ChatView({ chatId }: { chatId: string }) {
  const [chatTitle, setChatTitle] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(defaultComposerToolState.webSearchEnabled);
  const [imageGenerationEnabled, setImageGenerationEnabled] = useState(defaultComposerToolState.imageGenerationEnabled);
  const [imageAspectRatio, setImageAspectRatio] = useState<ImageAspectRatio>(defaultComposerToolState.imageAspectRatio);
  const [isComposerToolStateLoaded, setIsComposerToolStateLoaded] = useState(false);
  const [isChatHydrated, setIsChatHydrated] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const composerContentRef = useRef<HTMLDivElement>(null);
  const dotsContainerRef = useRef<HTMLDivElement>(null);
  const initialMsgProcessed = useRef(false);
  const messagesRef = useRef(messages);
  const sendMessageRef = useRef<((text: string, overrideFiles?: AttachedFile[], overrideWebSearch?: boolean, overrideImageGeneration?: boolean, overrideImageAspectRatio?: ImageAspectRatio, overrideImageEdit?: ImageEditRequestPayload) => void | Promise<void>) | null>(null);
  const imageStudioSessionRef = useRef(0);
  const [imageStudioPreview, setImageStudioPreview] = useState<{
    sessionId: number;
    image: ExtractedGeneratedImage;
    initialMode: ImageStudioMode;
  } | null>(null);
  const [activeUserMsgId, setActiveUserMsgId] = useState<string | null>(null);
  const [activeMobileActionMsgId, setActiveMobileActionMsgId] = useState<string | null>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const scrollBottomBtnRef = useRef<HTMLButtonElement>(null);
  const [composerReserve, setComposerReserve] = useState(160);
  const [feedbackMap, setFeedbackMap] = useState(() => getFeedbackMap());
  const [feedbackTarget, setFeedbackTarget] = useState<{ messageId: string; isError: boolean; rating: 'like' | 'dislike'; versionIndex: number } | null>(null);
  const [searchSidebar, setSearchSidebar] = useState<{ messageId: string; sources: SearchSource[] } | null>(null);
  const [isSearchSidebarOpen, setIsSearchSidebarOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const activeSidebarSources = React.useMemo(() => {
    if (!searchSidebar) return [];
    const liveMessage = messages.find(m => m.id === searchSidebar.messageId);
    return liveMessage?.searchSources && liveMessage.searchSources.length > 0
      ? liveMessage.searchSources
      : searchSidebar.sources;
  }, [messages, searchSidebar]);

  const handleToggleSearchSidebar = useCallback((messageId: string, sources: SearchSource[]) => {
    if (!sources.length) return;
    if (isSearchSidebarOpen && searchSidebar?.messageId === messageId) {
      setIsSearchSidebarOpen(false);
      return;
    }
    setSearchSidebar({ messageId, sources });
    setIsSearchSidebarOpen(true);
  }, [isSearchSidebarOpen, searchSidebar?.messageId]);

  // Mobile floating scroll-to-bottom visibility
  useEffect(() => {
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      if (window.innerWidth >= 640) {
        setShowScrollBottomBtn(false);
        return;
      }
      const distFromBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
      setShowScrollBottomBtn(distFromBottom > 220);
    };

    handleScroll();
    scrollEl.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      scrollEl.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [messages.length]);

  // Animate floating scroll-to-bottom pill with GSAP
  useEffect(() => {
    const btnEl = scrollBottomBtnRef.current;
    if (!btnEl) return;
    const reduce = prefersReducedMotion();
    gsap.killTweensOf(btnEl);
    if (showScrollBottomBtn) {
      gsap.fromTo(
        btnEl,
        { opacity: 0, y: reduce ? 0 : 12, scale: reduce ? 1 : 0.88 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: reduce ? 0.01 : 0.28,
          ease: 'back.out(1.8)',
          clearProps: 'transform',
        }
      );
    } else {
      gsap.to(btnEl, {
        opacity: 0,
        y: reduce ? 0 : 10,
        scale: reduce ? 1 : 0.9,
        duration: reduce ? 0.01 : 0.18,
        ease: 'power2.in',
      });
    }
  }, [showScrollBottomBtn]);

  // Jump-to-message outline handler from MobileRightDrawer
  useEffect(() => {
    const handleJump = (event: Event) => {
      const msgId = (event as CustomEvent<{ messageId?: string }>).detail?.messageId;
      if (!msgId) return;
      const el = document.getElementById(`msg-${msgId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
      if (!prefersReducedMotion()) {
        gsap.fromTo(
          el,
          { scale: 0.98 },
          { scale: 1, duration: 0.45, ease: 'back.out(2)', clearProps: 'transform' }
        );
      }
    };
    window.addEventListener('deepchat:jump-to-message', handleJump);
    return () => window.removeEventListener('deepchat:jump-to-message', handleJump);
  }, []);

  // Keep the in-memory vote map in sync across tabs and after each submit
  useEffect(() => subscribeFeedback(() => setFeedbackMap(getFeedbackMap())), [chatId]);

  const feedbackFor = useCallback((messageId: string, versionIndex = 1) =>
    getFeedbackForVersion(feedbackMap, chatId, messageId, versionIndex), [chatId, feedbackMap]);

  const handleRemoveFeedback = useCallback(async (messageId: string, versionIndex = 1) => {
    const removed = await submitMessageFeedback(chatId, messageId, null, [], '', versionIndex);
    if (removed) toast('Feedback removed', { icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> });
    return removed;
  }, [chatId]);

  // Both thumbs open the "Share feedback" sheet, preselected to the tapped
  // direction; the chips list adapts to the message kind. Tapping the same
  // (filled) thumb again withdraws the vote, which is the only way to clear
  // feedback: no separate "Remove feedback" text anywhere
  // Votes are tracked per version so regenerating a response gives a fresh
  // neutral state while preserving prior version votes
  const handleToolbarFeedback = useCallback((messageId: string, rating: 'like' | 'dislike', versionIndex = 1) => {
    const current = feedbackFor(messageId, versionIndex)?.rating ?? null;
    if (current === rating) {
      void handleRemoveFeedback(messageId, versionIndex);
      return;
    }
    const message = messagesRef.current.find(item => item.id === messageId);
    setFeedbackTarget({ messageId, isError: message?.isError === true, rating, versionIndex });
  }, [feedbackFor, handleRemoveFeedback, messagesRef]);

  const handleDialogFeedbackSubmit = useCallback(async (messageId: string, rating: MessageRating, reasons: string[], details: string, versionIndex = 1) => {
    const ok = await submitMessageFeedback(chatId, messageId, rating, reasons, details, versionIndex);
    if (ok) toast('Thank you! Your feedback has been saved.', { icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" /> });
    else toast('Could not reach the server. Try again.', { icon: '⚠️' });
    return ok;
  }, [chatId]);

  const [feedbackClosing, setFeedbackClosing] = useState(false);
  const closeFeedbackDialog = useCallback(() => {
    const target = feedbackTarget;
    setFeedbackClosing(true);
    window.setTimeout(() => {
      if (target) {
        // Return focus to the thumb that opened the sheet (static labels)
        const msgEl = document.getElementById(`msg-${target.messageId}`);
        const label = target.rating === 'like' ? 'Like response' : 'Dislike response';
        const opener = msgEl ? Array.from(msgEl.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === label) : null;
        opener?.focus();
      }
      setFeedbackTarget(null);
      setFeedbackClosing(false);
    }, 180);
  }, [feedbackTarget]);

  const handleMessageFeedback = useCallback((messageId: string, rating: 'like' | 'dislike', versionIndex = 1) => {
    handleToolbarFeedback(messageId, rating, versionIndex);
  }, [handleToolbarFeedback]);

  const handleFilesUpload = async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const previewUrl = createAttachedPreviewUrl(file);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await uploadFile(formData);
        if (res.success && res.fileName) {
          setAttachedFiles(prev => [...prev, {
            name: res.fileName!,
            ext: res.ext || 'other',
            previewUrl,
            dataUrl: res.dataUrl,
            content: res.content,
            size: res.size
          }]);
          toast.success(`Attached ${res.fileName}`);
        } else {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          toast.error(res.error || 'Upload failed');
        }
      } catch {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        toast.error('Upload failed');
      }
    }

    setIsUploading(false);
  };
  useEffect(() => {
    if (initialMsgProcessed.current) {
      localStorage.setItem(`deepchat-draft-${chatId}`, input);
    }
  }, [input, chatId]);

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      const toolState = loadComposerToolState();
      setWebSearchEnabled(toolState.webSearchEnabled);
      setImageGenerationEnabled(toolState.imageGenerationEnabled);
      setImageAspectRatio(toolState.imageAspectRatio);
      setIsComposerToolStateLoaded(true);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!isComposerToolStateLoaded) return;
    saveComposerToolState({ webSearchEnabled, imageGenerationEnabled, imageAspectRatio });
  }, [webSearchEnabled, imageGenerationEnabled, imageAspectRatio, isComposerToolStateLoaded]);

  useEffect(() => {
    if (activeUserMsgId && dotsContainerRef.current) {
      const activeDot = dotsContainerRef.current.querySelector(`[data-dot-id="${activeUserMsgId}"]`);
      if (activeDot) {
        activeDot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeUserMsgId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const measureComposerReserve = () => {
      const scrollNode = scrollContainerRef.current;
      const composerNode = composerContentRef.current;
      if (!scrollNode || !composerNode) return;
      const scrollRect = scrollNode.getBoundingClientRect();
      const composerRect = composerNode.getBoundingClientRect();
      const isMobile = window.innerWidth < 640;
      const nextReserve = Math.ceil(Math.max(isMobile ? 92 : 112, scrollRect.bottom - composerRect.top + (isMobile ? 8 : 12)));
      setComposerReserve(current => Math.abs(current - nextReserve) > 1 ? nextReserve : current);
    };

    measureComposerReserve();

    // defer state update to avoid ResizeObserver loop error
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => { window.requestAnimationFrame(measureComposerReserve); })
      : null;
    if (resizeObserver) {
      if (composerContentRef.current) resizeObserver.observe(composerContentRef.current);
      if (scrollContainerRef.current) resizeObserver.observe(scrollContainerRef.current);
    }

    window.addEventListener('resize', measureComposerReserve);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measureComposerReserve);
    };
  }, [attachedFiles.length, input, isLoading, messages]);

  useEffect(() => {
    let mounted = true;
    const loadChat = async () => {
      const chat = await getChat(chatId) as ChatPayload | null;
      const urlParams = new URLSearchParams(window.location.search);
      const initialMsg = urlParams.get('msg');
      const draftMsg = urlParams.get('draft');
      const initialWebSearch = urlParams.get('web') === '1';
      const initialImageGeneration = urlParams.get('image') === '1';
      const initialImageAspectRatio = normalizeImageAspectRatio(urlParams.get('ratio'));

      if (!mounted) return;
      setIsSearchSidebarOpen(false);
      setSearchSidebar(null);

      if (chat?.title) {
        setChatTitle(chat.title);
      }

      if (chat?.pendingAttachedFiles && chat.pendingAttachedFiles.length > 0 && !initialMsgProcessed.current) {
        setAttachedFiles(chat.pendingAttachedFiles);
      }

      if (draftMsg && !initialMsgProcessed.current) {
        initialMsgProcessed.current = true;
        window.history.replaceState({}, '', `/chat/${chatId}`);
        setInput(draftMsg);

        if (chat && chat.messages) {
          setMessages(mergeActiveGeneration(chatId, chat.messages.map(normalizeMessageForDisplay)));
        }
      } else if (initialMsg !== null && !initialMsgProcessed.current) {
        initialMsgProcessed.current = true;
        window.history.replaceState({}, '', `/chat/${chatId}`);
        setWebSearchEnabled(initialWebSearch);
        setImageGenerationEnabled(initialImageGeneration);
        if (initialImageGeneration) setImageAspectRatio(initialImageAspectRatio);

        if (!chat || !chat.messages || chat.messages.length === 0) {
          setTimeout(() => {
            if (mounted) void sendMessageRef.current?.(initialMsg, chat?.pendingAttachedFiles, initialWebSearch, initialImageGeneration, initialImageAspectRatio);
          }, 0);
        } else {
          setMessages(mergeActiveGeneration(chatId, chat.messages.map(normalizeMessageForDisplay)));
        }
      } else {
        if (!initialMsgProcessed.current) {
          const savedDraft = localStorage.getItem(`deepchat-draft-${chatId}`);
          if (savedDraft) {
            setInput(savedDraft);
          }
          initialMsgProcessed.current = true;
        }
        if (chat && chat.messages) {
          if (chat.messages.length > 0) {
            setMessages(mergeActiveGeneration(chatId, chat.messages.map(normalizeMessageForDisplay)));
          }
        }
      }
      if (mounted && (initialMsg === null || (chat?.messages && chat.messages.length > 0))) {
        setIsChatHydrated(true);
      }
    };

    loadChat();
    return () => { mounted = false; };
  }, [chatId]);

  useEffect(() => {
    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace('msg-', '');
            setActiveUserMsgId(id);
          }
        });
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '-10% 0px -50% 0px',
        threshold: 0,
      }
    );

    const userNodes = document.querySelectorAll('.message-user');
    userNodes.forEach((node) => observerRef.current?.observe(node));

    return () => observerRef.current?.disconnect();
  }, [messages]);

  const applyGenerationSnapshot = useCallback((snapshot: ChatGenerationSnapshot) => {
    setMessages(prev => mergeGenerationSnapshot(prev, snapshot));
    setIsLoading(snapshot.isStreaming);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const syncId = window.setTimeout(() => {
      if (cancelled) return;
      const snapshot = getChatGenerationState(chatId);
      setIsLoading(snapshot?.isStreaming === true);
      if (snapshot) applyGenerationSnapshot(snapshot);
    }, 0);
    const unsubscribe = subscribeChatGeneration(chatId, applyGenerationSnapshot);
    return () => {
      cancelled = true;
      window.clearTimeout(syncId);
      unsubscribe();
    };
  }, [applyGenerationSnapshot, chatId]);

  useEffect(() => {
    let mounted = true;
    const reloadChatMessages = async (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : undefined;
      if (detail?.chatId && detail.chatId !== chatId) return;
      if (detail?.title) {
        setChatTitle(detail.title);
      }
      const chat = await getChat(chatId) as ChatPayload | null;
      if (!mounted) return;
      if (chat?.title) setChatTitle(chat.title);
      if (!chat?.messages) return;
      setMessages(mergeActiveGeneration(chatId, chat.messages.map(normalizeMessageForDisplay)));
    };

    window.addEventListener('chatUpdated', reloadChatMessages);
    return () => {
      mounted = false;
      window.removeEventListener('chatUpdated', reloadChatMessages);
    };
  }, [chatId]);

  const sendMessage = useCallback(async (text: string, overrideFiles?: AttachedFile[], overrideWebSearch?: boolean, overrideImageGeneration?: boolean, overrideImageAspectRatio?: ImageAspectRatio, overrideImageEdit?: ImageEditRequestPayload) => {
    const filesToUse = overrideFiles || attachedFiles;
    const cleanFilesToUse = filesToUse.map(stripAttachedPreview);
    const useWebSearch = typeof overrideWebSearch === 'boolean' ? overrideWebSearch : webSearchEnabled;
    const useImageGeneration = typeof overrideImageGeneration === 'boolean' ? overrideImageGeneration : imageGenerationEnabled;
    const useImageAspectRatio = normalizeImageAspectRatio(overrideImageAspectRatio || imageAspectRatio);
    if ((!text.trim() && filesToUse.length === 0) || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      attachedFiles: cleanFilesToUse.length > 0 ? cleanFilesToUse : undefined,
      webSearchEnabled: useWebSearch,
      imageGenerationEnabled: useImageGeneration,
      imageAspectRatio: useImageGeneration ? useImageAspectRatio : undefined,
      createdAt: new Date().toISOString(),
      chatIndex: messagesRef.current.length
    };

    const assistantMsgId = (Date.now() + 1).toString();
    const generationMode = useImageGeneration || overrideImageEdit ? 'image' : getSelectedGenerationMode();
    const assistantMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      reasoning: '',
      searchStatus: 'idle' as SearchStatus,
      searchHasReasoning: false,
      searchSources: [],
      readSources: [],
      thinkingSteps: [],
      clarification: undefined,
      createdAt: new Date().toISOString(),
      isStreaming: true,
      generationMode,
      imageAspectRatio: useImageGeneration ? useImageAspectRatio : undefined,
      chatIndex: messagesRef.current.length + 1
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    filesToUse.forEach(revokeAttachedPreview);
    setAttachedFiles([]);
    localStorage.removeItem(`deepchat-draft-${chatId}`);

    await saveMessage(chatId, userMessage);
    await saveMessage(chatId, assistantMessage);
    window.dispatchEvent(new CustomEvent('chatUpdated', { detail: { chatId } }));

    const currentMessages = await getChat(chatId).then(c => (c as ChatPayload | null)?.messages || []);
    const apiMessages = [...currentMessages.filter((m) => m.id !== assistantMsgId)];

    const snapshot = startChatGeneration(chatId, apiMessages, assistantMsgId, overrideImageEdit);
    applyGenerationSnapshot(snapshot);
  }, [applyGenerationSnapshot, attachedFiles, chatId, imageAspectRatio, imageGenerationEnabled, isLoading, webSearchEnabled]);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const handleOpenGeneratedImagePreview = useCallback(
    (image: ExtractedGeneratedImage, _index: number, initialMode: ImageStudioMode = 'view') => {
      imageStudioSessionRef.current += 1;
      setImageStudioPreview({
        sessionId: imageStudioSessionRef.current,
        image,
        initialMode,
      });
    },
    []
  );

  const handleSubmitImageStudioEdit = useCallback(
    async (request: ImageStudioEditRequest) => {
      setImageStudioPreview(null);
      const sourceThumb: AttachedFile[] = request.thumbnailDataUrl
        ? [
            {
              name: 'source-image.jpg',
              ext: 'jpg',
              dataUrl: request.thumbnailDataUrl,
            },
          ]
        : [];
      await sendMessage(
        request.userDisplayText,
        sourceThumb,
        false,
        true,
        request.aspectRatio,
        {
          mode: request.mode,
          prompt: request.modelPrompt,
          sourceImageDataUrl: request.sourceImageDataUrl,
          maskDataUrl: request.maskDataUrl,
          annotatedDataUrl: request.annotatedDataUrl,
        }
      );
    },
    [sendMessage]
  );

  const handleRegenerate = async (msgId: string) => {
    if (isLoading) return;

    const msgIndex = messages.findIndex(m => m.id === msgId);
    if (msgIndex <= 0) return;

    const assistantMsg = messages[msgIndex];
    if (assistantMsg.role !== 'assistant') return;

    const apiMessages = messages.slice(0, msgIndex);
    const prevUser = [...apiMessages].reverse().find(m => m.role === 'user');
    const generationMode = prevUser?.imageGenerationEnabled ? 'image' : getSelectedGenerationMode();

    const currentVersions = normalizeVersions(assistantMsg.versions || [{
      content: assistantMsg.content,
      reasoning: assistantMsg.reasoning,
      reasoningDuration: assistantMsg.reasoningDuration,
      searchStatus: assistantMsg.searchStatus,
      searchHasReasoning: assistantMsg.searchHasReasoning,
      searchSources: assistantMsg.searchSources,
      readSources: assistantMsg.readSources,
      thinkingSteps: assistantMsg.thinkingSteps,
      clarification: assistantMsg.clarification,
      clarificationAnswer: assistantMsg.clarificationAnswer,
      generationMode: assistantMsg.generationMode,
      isError: assistantMsg.isError === true
    }]);

    const prevIdx = assistantMsg.currentVersionIndex ?? currentVersions.length - 1;
    if (assistantMsg.isError === true && currentVersions[prevIdx] && currentVersions[prevIdx].isError === undefined) {
      currentVersions[prevIdx] = { ...currentVersions[prevIdx], isError: true };
    }

    const newVersionIndex = currentVersions.length;

    const updatedAssistantMessage = {
      ...assistantMsg,
      versions: [...currentVersions, { content: '', reasoning: '', versionIndex: newVersionIndex + 1, generationMode, isError: false }],
      currentVersionIndex: newVersionIndex,
      content: '',
      reasoning: '',
      searchStatus: 'idle' as SearchStatus,
      searchHasReasoning: false,
      searchSources: [],
      readSources: [],
      thinkingSteps: [],
      clarification: undefined,
      clarificationAnswer: undefined,
      reasoningDuration: undefined,
      isStreaming: true,
      isError: false,
      generationMode,
      imageAspectRatio: prevUser?.imageAspectRatio ?? assistantMsg.imageAspectRatio,
      memoriesSaved: false,
      memoriesSavedCount: undefined,
      memoryProvider: undefined,
      memoryModel: undefined
    };

    setMessages(prev => prev.map(m => m.id === msgId ? updatedAssistantMessage : m));
    await saveMessage(chatId, updatedAssistantMessage);

    const snapshot = startChatGeneration(chatId, apiMessages, msgId);
    applyGenerationSnapshot(snapshot);
  };

  const handleStopGeneration = () => {
    if (stopChatGeneration(chatId)) {
      toast.success('Generation stopped.');
    }
  };

  const handleEditUserMessage = useCallback(async (msgId: string, content: string) => {
    if (isLoading) return false;
    const nextContent = content.trim();
    if (!nextContent) {
      toast.error('Message cannot be empty.');
      return false;
    }

    const currentMessages = messagesRef.current;
    const latestUserMessage = [...currentMessages].reverse().find(m => m.role === 'user');
    if (latestUserMessage?.id !== msgId) return false;

    const targetIndex = currentMessages.findIndex(m => m.id === msgId);
    const targetMessage = currentMessages[targetIndex];
    if (!targetMessage || targetMessage.role !== 'user') return false;

    const updatedUserMessage = {
      ...targetMessage,
      content: nextContent
    };
    const nextMessage = currentMessages[targetIndex + 1];
    const generationMode = updatedUserMessage.imageGenerationEnabled ? 'image' : getSelectedGenerationMode();
    const assistantMessage = nextMessage?.role === 'assistant'
      ? {
        ...nextMessage,
        content: '',
        reasoning: '',
        searchStatus: 'idle' as SearchStatus,
        searchHasReasoning: false,
        searchSources: [],
        readSources: [],
        thinkingSteps: [],
        clarification: undefined,
        clarificationAnswer: undefined,
        reasoningDuration: undefined,
        versions: undefined,
        currentVersionIndex: undefined,
        createdAt: new Date().toISOString(),
        isStreaming: true,
        isError: false,
        isStopped: false,
        generationMode,
        imageAspectRatio: updatedUserMessage.imageAspectRatio,
        memoriesSaved: false,
        memoriesSavedCount: undefined,
        memoryProvider: undefined,
        memoryModel: undefined
      }
      : {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        reasoning: '',
        searchStatus: 'idle' as SearchStatus,
        searchHasReasoning: false,
        searchSources: [],
        readSources: [],
        thinkingSteps: [],
        clarification: undefined,
        clarificationAnswer: undefined,
        createdAt: new Date().toISOString(),
        isStreaming: true,
        generationMode,
        imageAspectRatio: updatedUserMessage.imageAspectRatio,
        chatIndex: targetIndex + 1
      };
    const nextMessages = [
      ...currentMessages.slice(0, targetIndex),
      updatedUserMessage,
      assistantMessage
    ];

    setMessages(nextMessages);
    await saveMessage(chatId, updatedUserMessage);
    await saveMessage(chatId, assistantMessage);
    window.dispatchEvent(new CustomEvent('chatUpdated', { detail: { chatId } }));

    const snapshot = startChatGeneration(chatId, nextMessages.slice(0, targetIndex + 1), assistantMessage.id);
    applyGenerationSnapshot(snapshot);
    return true;
  }, [applyGenerationSnapshot, chatId, isLoading]);

  const switchVersion = async (msgId: string, delta: number) => {
    if (isLoading) return;

    const targetMessage = messagesRef.current.find(m => m.id === msgId);
    if (!targetMessage?.versions) return;

    const versions = normalizeVersions(targetMessage.versions);
    let newIdx = (targetMessage.currentVersionIndex || 0) + delta;
    if (newIdx < 0) newIdx = 0;
    if (newIdx >= versions.length) newIdx = versions.length - 1;

    const version = versions[newIdx];
    const updatedMessage = {
      ...targetMessage,
      versions,
      currentVersionIndex: newIdx,
      content: version.content,
      reasoning: version.reasoning,
      reasoningDuration: version.reasoningDuration,
      searchStatus: version.searchStatus ?? (version.searchSources && version.searchSources.length > 0 ? 'completed' : 'idle'),
      searchHasReasoning: version.searchHasReasoning,
      searchSources: version.searchSources,
      readSources: version.readSources,
      thinkingSteps: version.thinkingSteps,
      clarification: version.clarification,
      clarificationAnswer: version.clarificationAnswer,
      generationMode: version.generationMode,
      isError: version.isError === true
    };

    setMessages(prev => prev.map(m => m.id === msgId ? updatedMessage : m));
    await saveMessage(chatId, updatedMessage);
  };

  const handleClarificationAnswer = useCallback(async (msgId: string, option: AgentClarificationOption, customValue?: string) => {
    if (isLoading) return false;
    const currentMessages = messagesRef.current;
    const msgIndex = currentMessages.findIndex(m => m.id === msgId);
    const assistantMsg = currentMessages[msgIndex];
    if (!assistantMsg || assistantMsg.role !== 'assistant' || !assistantMsg.clarification) return false;

    const answerValue = option.shortcut === '4' ? (customValue || '').trim() : option.value;
    if (!answerValue) {
      toast.error('Type your answer first.');
      return false;
    }

    const answer: AgentClarificationAnswer = {
      shortcut: option.shortcut,
      question: assistantMsg.clarification.question,
      label: option.shortcut === '4' ? answerValue : option.label,
      value: answerValue
    };
    const continuationPrompt = formatClarificationAnswer(assistantMsg.clarification, option, answerValue);
    const versions = assistantMsg.versions ? normalizeVersions(assistantMsg.versions) : undefined;
    const currentVersionIndex = versions ? Math.min(Math.max(typeof assistantMsg.currentVersionIndex === 'number' ? assistantMsg.currentVersionIndex : versions.length - 1, 0), versions.length - 1) : undefined;
    if (versions && currentVersionIndex !== undefined && versions[currentVersionIndex]) {
      versions[currentVersionIndex] = {
        ...versions[currentVersionIndex],
        clarification: undefined,
        clarificationAnswer: answer
      };
    }

    const updatedAssistantMessage = {
      ...assistantMsg,
      content: '',
      reasoning: '',
      searchStatus: 'idle' as SearchStatus,
      searchHasReasoning: false,
      searchSources: [],
      readSources: [],
      clarification: undefined,
      clarificationAnswer: answer,
      versions,
      currentVersionIndex,
      reasoningDuration: undefined,
      isStreaming: true,
      isError: false,
      isStopped: false,
      memoriesSaved: false,
      memoriesSavedCount: undefined,
      memoryProvider: undefined,
      memoryModel: undefined
    };
    const nextMessages = currentMessages.map(m => m.id === msgId ? updatedAssistantMessage : m);

    setMessages(nextMessages);
    setInput('');
    await saveMessage(chatId, updatedAssistantMessage);
    window.dispatchEvent(new CustomEvent('chatUpdated', { detail: { chatId } }));

    const apiMessages = [
      ...nextMessages.slice(0, msgIndex),
      {
        id: `clarification-${Date.now()}`,
        role: 'user',
        content: continuationPrompt
      }
    ];
    const snapshot = startChatGeneration(chatId, apiMessages, msgId);
    applyGenerationSnapshot(snapshot);
    return true;
  }, [applyGenerationSnapshot, chatId, isLoading]);

  const displayMessages = messages.filter(m => !(m.role === 'user' && isGeneratedClarificationAnswerContent(m.content)));
  const userMessages = displayMessages.filter(m => m.role === 'user');
  const latestUserMessageId = userMessages[userMessages.length - 1]?.id;
  const showCustomScrollbar = userMessages.length >= 3;
  const activeClarificationMessage = [...messages].reverse().find(m => m.role === 'assistant' && m.clarification && !m.clarificationAnswer && !m.isStreaming);

  return (
    <div className="deepchat-chat-view relative flex min-h-0 flex-1 flex-row overflow-hidden bg-[var(--dc-canvas)] text-[var(--dc-text)]">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {chatTitle && (
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 z-10 hidden h-16 items-start px-5 pt-3.5 sm:flex"
          style={{ background: 'linear-gradient(to bottom, var(--dc-canvas) 0%, var(--dc-canvas) 52%, transparent 100%)' }}
        >
          <h1 className="pointer-events-auto truncate text-[15px] font-semibold tracking-[-0.01em] text-[var(--dc-text-strong)]">
            <AnimatedChatTitle title={chatTitle} chatId={chatId} />
          </h1>
        </div>
      )}
      <div
        ref={scrollContainerRef}
        style={{ scrollPaddingBottom: composerReserve }}
        className={`flex-1 overflow-y-auto px-4 pb-4 pt-[calc(env(safe-area-inset-top,0px)+4rem)] sm:px-8 sm:pb-6 sm:pt-16 ${showCustomScrollbar ? '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]' : 'custom-scrollbar'}`}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 sm:gap-7" style={{ paddingBottom: Math.max(composerReserve - 42, 68) }}>
          {isChatHydrated && messages.length === 0 && !isLoading && (
            <div className="mt-24 flex flex-col items-center justify-center text-center">
              <DotRevealHeadline text="Start a new thought with DeepChat" ready size="compact" />
            </div>
          )}

          {displayMessages.map((msg, idx) => {
            const activeVersion = (msg.currentVersionIndex ?? (msg.versions ? msg.versions.length - 1 : 0)) + 1;
            let requestedAspectRatio = msg.imageAspectRatio;
            if (!requestedAspectRatio && msg.role === 'assistant') {
              for (let i = idx - 1; i >= 0; i -= 1) {
                if (displayMessages[i]?.role === 'user') {
                  requestedAspectRatio = displayMessages[i]?.imageAspectRatio;
                  break;
                }
              }
            }
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                deferOffscreen={idx < displayMessages.length - 6}
                requestedAspectRatio={requestedAspectRatio}
                onOpenGeneratedImagePreview={handleOpenGeneratedImagePreview}
                onRegenerate={() => handleRegenerate(msg.id)}
                onSwitchVersion={(delta) => switchVersion(msg.id, delta)}
                canEditUserMessage={msg.role === 'user' && msg.id === latestUserMessageId}
                onEditUserMessage={(content) => handleEditUserMessage(msg.id, content)}
                isMobileActionsOpen={activeMobileActionMsgId === msg.id}
                onActivateMobileActions={() => setActiveMobileActionMsgId(msg.id)}
                feedbackRating={feedbackFor(msg.id, activeVersion)?.rating ?? null}
                onLike={msg.role === 'assistant' && !msg.isStreaming ? () => handleMessageFeedback(msg.id, 'like', activeVersion) : undefined}
                onDislike={msg.role === 'assistant' && !msg.isStreaming ? () => handleMessageFeedback(msg.id, 'dislike', activeVersion) : undefined}
                isSearchSidebarOpen={isSearchSidebarOpen && searchSidebar?.messageId === msg.id}
                onOpenSearchResults={handleToggleSearchSidebar}
              />
            );
          })}

          {displayMessages.length > 0 && (
            <div className="pt-4 pb-0 text-center">
              <p className="inline-flex px-3 text-[11.5px] font-normal text-[var(--dc-text-muted)] sm:text-[12px]">
                DeepChat can make mistakes. Verify important information before using it.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Floating Scroll-to-Bottom Pill */}
      <button
        ref={scrollBottomBtnRef}
        type="button"
        onClick={() => {
          triggerSubtleHaptic(6);
          const el = scrollContainerRef.current;
          if (!el) return;
          el.scrollTo({
            top: el.scrollHeight,
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          });
        }}
        aria-label="Scroll to bottom"
        style={{ bottom: composerReserve + 12 }}
        className={`fixed right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)]/95 text-[var(--dc-text-strong)] shadow-lg backdrop-blur-md transition-transform active:scale-90 sm:hidden ${
          showScrollBottomBtn ? 'pointer-events-auto' : 'pointer-events-none opacity-0'
        }`}
      >
        <ChevronDown className="h-5 w-5" strokeWidth={2.25} />
      </button>

      {showCustomScrollbar && (
        <div className="absolute right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-500 sm:flex">
          <div className="rounded-full border border-slate-200/60 bg-slate-200/30 px-2 py-4 shadow-sm backdrop-blur-sm transition-colors hover:bg-slate-200/50 dark:border-slate-700/70 dark:bg-slate-950/80 dark:shadow-black/30 dark:hover:bg-slate-900/90">
            <div
              ref={dotsContainerRef}
              className="flex flex-col items-center gap-3 overflow-y-auto max-h-[100px] scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-full"
            >
              {userMessages.map((m, idx) => {
                const isActive = activeUserMsgId === m.id;
                return (
                  <button
                    key={m.id}
                    data-dot-id={m.id}
                    title={`Jump to User Message ${idx + 1}`}
                    onClick={() => document.getElementById(`msg-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className={`shrink-0 rounded-full transition-all shadow-sm duration-300 ${isActive
                      ? 'w-3 h-3 bg-slate-800 ring-2 ring-slate-300/70 scale-110 dark:bg-slate-300 dark:ring-slate-600/70'
                      : 'w-2 h-2 bg-slate-300 hover:bg-slate-600 hover:scale-125 dark:bg-slate-600 dark:hover:bg-slate-300'
                      }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-0 left-0 z-20 flex w-full flex-col items-center bg-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-8 sm:pb-5 sm:pt-2">
        <div ref={composerContentRef} className="pointer-events-auto flex w-full max-w-[40rem] flex-col gap-2 sm:max-w-[48rem]">
          {activeClarificationMessage?.clarification ? (
            <ClarificationDock
              clarification={activeClarificationMessage.clarification}
              isBusy={isLoading}
              onSelect={(option, customValue) => handleClarificationAnswer(activeClarificationMessage.id, option, customValue)}
            />
          ) : (
            <ChatComposer
              value={input}
              attachedFiles={attachedFiles}
              isUploading={isUploading}
              isBusy={isLoading}
              webSearchEnabled={webSearchEnabled}
              imageGenerationEnabled={imageGenerationEnabled}
              imageAspectRatio={imageAspectRatio}
              maxTextareaHeight={256}
              onChange={setInput}
              onSubmit={(value) => sendMessage(value)}
              onStop={handleStopGeneration}
              onToggleWebSearch={setWebSearchEnabled}
              onToggleImageGeneration={setImageGenerationEnabled}
              onImageAspectRatioChange={setImageAspectRatio}
              onFilesUpload={handleFilesUpload}
              onAttachRecentFile={(file) => setAttachedFiles(prev => prev.some(item => item.name === file.name && item.ext === file.ext) ? prev : [...prev, file])}
              onRemoveFile={(index) => setAttachedFiles(prev => {
                const next = prev.filter((_, itemIndex) => itemIndex !== index);
                const removed = prev[index];
                if (removed) revokeAttachedPreview(removed);
                return next;
              })}
            />
          )}
        </div>
      </div>

      {feedbackTarget && (
        <FeedbackDialog
          open
          closing={feedbackClosing}
          messageKind={feedbackTarget.isError ? 'error' : 'normal'}
          reasons={feedbackTarget.rating === 'like' ? LIKE_REASONS : (feedbackTarget.isError ? ERROR_DISLIKE_REASONS : DISLIKE_REASONS)}
          rating={feedbackTarget.rating}
          initialReasons={feedbackFor(feedbackTarget.messageId, feedbackTarget.versionIndex)?.rating === feedbackTarget.rating ? (feedbackFor(feedbackTarget.messageId, feedbackTarget.versionIndex)?.reasons ?? []) : []}
          initialDetails={feedbackFor(feedbackTarget.messageId, feedbackTarget.versionIndex)?.rating === feedbackTarget.rating ? (feedbackFor(feedbackTarget.messageId, feedbackTarget.versionIndex)?.details ?? '') : ''}
          onClose={closeFeedbackDialog}
          onSubmit={(rating, reasons, details) => handleDialogFeedbackSubmit(feedbackTarget.messageId, rating, reasons, details, feedbackTarget.versionIndex)}
        />
      )}

      {imageStudioPreview && (
        <GeneratedImagePreviewModal
          key={`img-studio-${imageStudioPreview.sessionId}`}
          isOpen
          image={imageStudioPreview.image}
          initialMode={imageStudioPreview.initialMode}
          isBusy={isLoading}
          onClose={() => setImageStudioPreview(null)}
          onSubmitEdit={handleSubmitImageStudioEdit}
        />
      )}
      </div>
      {searchSidebar && (
        <SearchResultsSidebar
          open={isSearchSidebarOpen}
          sources={activeSidebarSources}
          messageId={searchSidebar.messageId}
          onClose={() => setIsSearchSidebarOpen(false)}
          onExited={() => setSearchSidebar(null)}
        />
      )}
    </div>
  );
}

function ClarificationDock({ clarification, isBusy, onSelect }: { clarification: AgentClarification, isBusy?: boolean, onSelect: (option: AgentClarificationOption, customValue?: string) => Promise<boolean> | boolean }) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const customOption = clarification.options.find(option => option.shortcut === '4');
  const submitCustom = async () => {
    if (!customOption) return;
    const sent = await onSelect(customOption, customValue);
    if (sent) {
      setCustomValue('');
      setIsCustomOpen(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-200/60">
      <p className="px-2 pb-3 text-center text-sm font-extrabold leading-relaxed text-slate-800">{clarification.question}</p>
      {isCustomOpen ? (
        <div className="space-y-2">
          <textarea
            value={customValue}
            onChange={(event) => setCustomValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setIsCustomOpen(false);
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void submitCustom();
            }}
            rows={3}
            autoFocus
            placeholder="Type your own answer..."
            className="max-h-40 min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCustomOpen(false)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-extrabold text-slate-600 transition hover:bg-slate-200"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
            <button
              type="button"
              disabled={isBusy || !customValue.trim()}
              onClick={() => void submitCustom()}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-indigo-600 px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Check className="h-3.5 w-3.5" />
              Send
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          {clarification.options.map(option => (
            <button
              key={option.shortcut}
              type="button"
              disabled={isBusy}
              onClick={() => option.shortcut === '4' ? setIsCustomOpen(true) : void onSelect(option)}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${option.tone === 'muted' ? 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-slate-100' : 'border-indigo-100 bg-indigo-50/80 text-slate-800 hover:border-indigo-200 hover:bg-indigo-100/80'}`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${option.tone === 'muted' ? 'bg-white text-slate-500' : 'bg-white text-indigo-600'}`}>
                {option.shortcut}
              </span>
              <span className="min-w-0 text-sm font-extrabold leading-snug">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ClarificationAnswerBadge({ answer }: { answer: AgentClarificationAnswer }) {
  return (
    <div className="mb-3 max-w-full rounded-2xl rounded-tl-sm border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-slate-800 shadow-sm">
      {answer.question && (
        <p className="mb-2 text-xs font-bold leading-relaxed text-slate-500">{answer.question}</p>
      )}
      <div className="flex min-w-0 items-center gap-2 text-sm font-extrabold text-indigo-700">
        <Check className="h-4 w-4 shrink-0" />
        <span className="min-w-0 break-words">Answer {answer.shortcut}: {answer.label}</span>
      </div>
    </div>
  );
}

type MessageBubbleProps = {
  message: ChatMessage;
  deferOffscreen?: boolean;
  requestedAspectRatio?: ImageAspectRatio;
  onOpenGeneratedImagePreview?: (
    image: ExtractedGeneratedImage,
    index: number,
    initialMode?: ImageStudioMode
  ) => void;
  onRegenerate?: () => void;
  onSwitchVersion?: (delta: number) => void;
  canEditUserMessage?: boolean;
  onEditUserMessage?: (content: string) => Promise<boolean>;
  isMobileActionsOpen?: boolean;
  onActivateMobileActions?: () => void;
  feedbackRating?: 'like' | 'dislike' | null;
  onLike?: () => void;
  onDislike?: () => void;
  isSearchSidebarOpen?: boolean;
  onOpenSearchResults?: (messageId: string, sources: SearchSource[]) => void;
};

function MemorySavedBadge({ memoryKey }: { memoryKey: string }) {
  return <MemorySavedBadgeContent key={memoryKey} />;
}

function MemorySavedBadgeContent() {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const hideTimer = window.setTimeout(() => setVisible(false), 3600);
    const unmountTimer = window.setTimeout(() => setMounted(false), 3920);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(unmountTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      className={`mt-2 ml-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700 shadow-sm transition-all duration-300 ease-out will-change-transform ${visible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-1 opacity-0 scale-95'}`}
    >
      <Check className="h-3.5 w-3.5" />
      Memories saved.
    </div>
  );
}

function MessageActionButton({ label, tooltip = label, disabled, className, onClick, ariaPressed, children }: { label: string; tooltip?: string; disabled?: boolean; className: string; onClick?: () => void; ariaPressed?: boolean; children: React.ReactNode }) {
  return (
    <Tooltip label={tooltip}>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={className}
        aria-label={label}
        aria-pressed={ariaPressed}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function CopyActionIcon({ copied, className = 'h-4 w-4' }: { copied: boolean; className?: string }) {
  if (copied) return <Check className={`${className} text-emerald-500`} strokeWidth={2.5} />;
  return <Copy className={className} strokeWidth={2} />;
}

function UserMessageEditor({
  value,
  isSaving,
  onChange,
  onCancel,
  onSave,
}: {
  value: string;
  isSaving: boolean;
  onChange: (next: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = value.trim().length > 0 && !isSaving;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || prefersReducedMotion()) return;
    gsap.fromTo(
      el,
      { opacity: 0, scale: 0.985, y: 3 },
      { opacity: 1, scale: 1, y: 0, duration: 0.2, ease: 'power3.out', clearProps: 'transform,opacity' }
    );
  }, []);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
  }, []);

  useLayoutEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.min(Math.max(node.scrollHeight, 26), 220)}px`;
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="w-full min-w-0 rounded-[20px] border border-[var(--dc-border)] bg-[var(--dc-surface)] p-3 shadow-md shadow-slate-900/5 ring-1 ring-black/[0.03] transition-colors focus-within:border-[var(--dc-border-strong)] dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-black/30 dark:ring-white/[0.04] sm:rounded-[24px] sm:p-3.5"
    >
      <textarea
        ref={textareaRef}
        value={value}
        rows={1}
        disabled={isSaving}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && canSend) {
            event.preventDefault();
            onSave();
          }
        }}
        placeholder="Edit your message..."
        aria-label="Edit message"
        className="custom-scrollbar block max-h-[220px] w-full resize-none overflow-y-auto bg-transparent px-1 py-0.5 text-[15.5px] font-medium leading-[1.55] text-[var(--dc-text-strong)] outline-none placeholder:text-[var(--dc-text-placeholder)] sm:text-[16px] sm:leading-relaxed"
      />
      <div className="mt-2.5 flex items-center justify-end gap-2 sm:justify-between">
        <span className="hidden pl-1 text-[11px] font-medium text-[var(--dc-text-faint)] sm:inline">
          Esc to cancel · Ctrl/⌘ + Enter to send
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="inline-flex min-h-[38px] cursor-pointer items-center justify-center rounded-full border border-[var(--dc-border)] bg-[var(--dc-fill)] px-4 text-[13.5px] font-medium leading-none text-[var(--dc-text-strong)] transition-colors hover:bg-[var(--dc-fill-hover)] active:scale-[0.97] disabled:opacity-50 sm:min-h-[32px] sm:px-3.5 sm:text-[13px]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={onSave}
            className="inline-flex min-h-[38px] cursor-pointer items-center justify-center rounded-full bg-[var(--dc-invert)] px-4 text-[13.5px] font-medium leading-none text-[var(--dc-text-on-invert)] transition-colors hover:bg-[var(--dc-invert-hover)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-[32px] sm:px-3.5 sm:text-[13px]"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

const MessageBubble = React.memo(function MessageBubble({ message, deferOffscreen = false, requestedAspectRatio, onOpenGeneratedImagePreview, onRegenerate, onSwitchVersion, canEditUserMessage = false, onEditUserMessage, isMobileActionsOpen = false, onActivateMobileActions, feedbackRating = null, onLike, onDislike, isSearchSidebarOpen = false, onOpenSearchResults }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isEditingUserMessage, setIsEditingUserMessage] = useState(false);
  const [isSavingUserEdit, setIsSavingUserEdit] = useState(false);
  const [userDraft, setUserDraft] = useState(message.content || '');
  const [previewAttachment, setPreviewAttachment] = useState<AttachedFile | null>(null);
  const [isAttachmentPreviewOpen, setIsAttachmentPreviewOpen] = useState(false);

  const handlePreviewGeneratedImage = useCallback(
    (image: ExtractedGeneratedImage, index: number, initialMode: ImageStudioMode = 'view') => {
      if (onOpenGeneratedImagePreview) {
        onOpenGeneratedImagePreview(image, index, initialMode);
        return;
      }
      const src = image.src;
      const mimeMatch = src.match(/^data:image\/([a-z0-9.+-]+)/i);
      const pathMatch = src.split('?')[0]?.match(/\.([a-z0-9]+)$/i);
      const ext = (mimeMatch?.[1] || pathMatch?.[1] || 'png')
        .toLowerCase()
        .replace('jpeg', 'jpg')
        .replace('svg+xml', 'svg');
      const name = `generated-image-${index + 1}.${ext}`;
      setPreviewAttachment(
        src.startsWith('data:')
          ? { name, ext, dataUrl: src }
          : { name, ext, previewUrl: src }
      );
      setIsAttachmentPreviewOpen(true);
    },
    [onOpenGeneratedImagePreview]
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard!');
  };

  const startUserEdit = () => {
    setUserDraft(message.content || '');
    setIsEditingUserMessage(true);
  };

  const cancelUserEdit = () => {
    setUserDraft(message.content || '');
    setIsEditingUserMessage(false);
  };

  const saveUserEdit = async () => {
    if (!onEditUserMessage || isSavingUserEdit) return;
    setIsSavingUserEdit(true);
    try {
      const saved = await onEditUserMessage(userDraft);
      if (saved) setIsEditingUserMessage(false);
    } finally {
      setIsSavingUserEdit(false);
    }
  };

  const hasVersions = message.versions && message.versions.length > 1;
  const totalVersions = message.versions?.length || 1;
  const currentIdx = Math.min(Math.max(message.currentVersionIndex || 0, 0), totalVersions - 1);
  const mainAssistantContent = !isUser ? (message.content || '') : '';
  const searchSources = React.useMemo(() => message.searchSources ?? [], [message.searchSources]);
  const hasReasoningBlock = !isUser && (
    Boolean(message.reasoning) ||
    Boolean(message.thinkingSteps && message.thinkingSteps.some(step => step.type === 'thought')) ||
    ((Boolean(message.isStreaming) || message.searchStatus === 'searching') && message.searchHasReasoning === true)
  );
  const hasStandaloneSearch = !isUser && !hasReasoningBlock && (
    message.searchStatus === 'searching' ||
    searchSources.length > 0
  );
  const handleOpenThisSearchSidebar = useCallback(() => {
    if (searchSources.length > 0) {
      onOpenSearchResults?.(message.id, searchSources);
    }
  }, [message.id, onOpenSearchResults, searchSources]);
  const extractedImageContent = React.useMemo(
    () => extractGeneratedImagesFromMarkdown(mainAssistantContent),
    [mainAssistantContent]
  );
  const hasGeneratedImages = !isUser && !message.isError && extractedImageContent.images.length > 0;
  const useImageStudioStage =
    !isUser &&
    !message.isError &&
    (!message.reasoning || hasGeneratedImages) &&
    ((message.generationMode === 'image' && (Boolean(message.isStreaming) || hasGeneratedImages)) ||
      (!message.isStreaming && hasGeneratedImages && !extractedImageContent.remainingText));

  return (
    <div
      id={`msg-${message.id}`}
      onClick={onActivateMobileActions}
      className={`group/message flex w-full items-start ${isUser ? 'justify-end message-user' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 ${deferOffscreen ? 'dc-mob-msg-deferred' : ''}`}
    >
      <div className={`relative flex min-w-0 flex-col ${isUser ? (isEditingUserMessage ? 'w-full max-w-[94%] items-end sm:max-w-[min(85%,560px)]' : 'max-w-[78%] items-end sm:max-w-[52%]') : 'w-full max-w-[44rem] items-start sm:max-w-[48rem]'}`}>
        {hasReasoningBlock && (
          <ThinkingSection
            content={message.reasoning || ''}
            isStreaming={Boolean(message.isStreaming && !message.content)}
            duration={message.reasoningDuration}
            searchStatus={message.searchStatus}
            searchSources={searchSources}
            readSources={message.readSources}
            thinkingSteps={message.thinkingSteps}
            answerContent={mainAssistantContent}
            isSidebarOpen={isSearchSidebarOpen}
            onOpenSearchResults={searchSources.length > 0 ? handleOpenThisSearchSidebar : undefined}
          />
        )}

        {hasStandaloneSearch && (
          <SearchStatusIndicator
            status={message.searchStatus}
            sources={searchSources}
            isSidebarOpen={isSearchSidebarOpen}
            onOpenSearchResults={handleOpenThisSearchSidebar}
          />
        )}

        {!isUser && message.clarificationAnswer && (
          <ClarificationAnswerBadge answer={message.clarificationAnswer} />
        )}

        {isUser && message.attachedFiles && message.attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap justify-end gap-2">
            {message.attachedFiles.map((file, idx: number) => {
              const displayName = getComposerDisplayName(file.name);
              return (
                <button
                  key={`${file.name}-${idx}`}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreviewAttachment(file);
                    setIsAttachmentPreviewOpen(true);
                  }}
                  aria-label={`Preview ${displayName}`}
                  className="dc-attach-card flex max-w-[216px] cursor-pointer items-center gap-2 rounded-xl p-1.5 pr-3 text-left active:scale-[0.97]"
                >
                  <div className="dc-tools-icon-well h-8 w-8 rounded-lg">
                    {getComposerFileIcon(file.ext, 'h-4 w-4')}
                  </div>
                  <div className="flex min-w-0 flex-col pr-1">
                    <span className="block w-full truncate text-[11.5px] font-semibold text-[var(--dc-text-strong)]">
                      {displayName}
                    </span>
                    <span className="text-[9.5px] font-semibold uppercase tracking-wider text-[var(--dc-text-muted)]">
                      {file.ext}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {useImageStudioStage ? (
          <div className="w-full max-w-full">
            <ImageGenerationStage
              key={`${message.id}-v${currentIdx}-${message.createdAt || ''}`}
              isGenerating={Boolean(message.isStreaming)}
              images={extractedImageContent.images}
              requestedAspectRatio={requestedAspectRatio ?? message.imageAspectRatio}
              onPreviewImage={handlePreviewGeneratedImage}
            />
            {extractedImageContent.remainingText && (
              <div className="mt-3 max-w-full px-0 py-0 text-black dark:text-slate-100">
                <MarkdownRenderer
                  content={extractedImageContent.remainingText}
                  isStreaming={message.isStreaming}
                  searchSources={message.searchSources}
                />
              </div>
            )}
          </div>
        ) : isUser ? (
          isEditingUserMessage ? (
            <UserMessageEditor
              value={userDraft}
              isSaving={isSavingUserEdit}
              onChange={setUserDraft}
              onCancel={cancelUserEdit}
              onSave={() => void saveUserEdit()}
            />
          ) : (
            <div className="max-w-full rounded-[20px] rounded-br-[6px] border border-[var(--dc-border-subtle)] bg-[var(--dc-fill)] px-4 py-2.5 text-[var(--dc-text-strong)] shadow-none sm:rounded-[1.65rem] sm:border-0 sm:bg-[#aeeefa] dark:sm:!bg-[var(--dc-user-bubble-sm)] sm:px-5 sm:py-3.5 dark:text-slate-100">
              <div className="whitespace-pre-wrap break-words text-[15.5px] font-medium leading-[1.55] sm:text-[17px] sm:leading-relaxed">
                {message.content}
              </div>
            </div>
          )
        ) : mainAssistantContent ? (
          <div className={`max-w-full ${message.isError ? 'px-1 py-1 text-red-600' : 'px-0 py-0 text-black dark:text-slate-100'}`}>
            <MarkdownRenderer content={mainAssistantContent} isStreaming={message.isStreaming} searchSources={message.searchSources} />
          </div>
        ) : message.isStreaming && !hasReasoningBlock && !hasStandaloneSearch && (
          <div className="flex min-h-8 w-fit items-center px-0.5 py-1.5" role="status" aria-label="Generating response">
            <KineticThinkingDotIcon active hovered={false} />
          </div>
        )}

        {!isUser && !message.isStreaming && message.memoriesSaved && (
          <MemorySavedBadge memoryKey={`${message.id}-${message.memoriesSavedCount || 1}`} />
        )}

        {isUser && !isEditingUserMessage && (
          <div className={`mt-1 max-w-full flex-wrap items-center justify-end gap-1 transition-opacity duration-200 sm:absolute sm:right-0 sm:top-full sm:mt-0 sm:pt-1 sm:flex sm:h-7 sm:min-h-0 sm:gap-1.5 sm:pointer-events-none sm:opacity-0 sm:group-hover/message:pointer-events-auto sm:group-hover/message:opacity-100 sm:group-focus-within/message:pointer-events-auto sm:group-focus-within/message:opacity-100 ${isMobileActionsOpen ? 'flex min-h-9 pointer-events-auto opacity-100' : 'hidden pointer-events-none opacity-0'}`}>
            <MessageActionButton
              label={copied ? 'Copied' : 'Copy message'}
              tooltip={copied ? 'Copied' : 'Copy message'}
              onClick={handleCopy}
              className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-full p-2 text-[#aaa0a0] transition-colors hover:text-black sm:min-h-0 sm:min-w-0 sm:p-1"
            >
              <CopyActionIcon copied={copied} />
            </MessageActionButton>
            {canEditUserMessage && (
              <MessageActionButton
                label="Edit message"
                tooltip="Edit message"
                onClick={startUserEdit}
                className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-full p-2 text-[#aaa0a0] transition-colors hover:text-black sm:min-h-0 sm:min-w-0 sm:p-1"
              >
                <Edit3 className="h-4 w-4" strokeWidth={2} />
              </MessageActionButton>
            )}
          </div>
        )}

        {!isUser && !message.isStreaming && (
          <div className={`mt-1.5 ml-0 flex min-h-8 max-w-full flex-wrap items-center gap-1 transition-opacity duration-200 sm:absolute sm:left-0 sm:top-full sm:mt-0 sm:pt-1.5 sm:min-h-7 sm:gap-1.5 sm:pointer-events-none sm:opacity-0 sm:group-hover/message:pointer-events-auto sm:group-hover/message:opacity-100 sm:group-focus-within/message:pointer-events-auto sm:group-focus-within/message:opacity-100 ${isMobileActionsOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-auto opacity-100 sm:pointer-events-none sm:opacity-0'}`}>
            {hasVersions && (
              <div className="mr-1 flex items-center gap-1 rounded-full px-1 py-0.5">
                <MessageActionButton
                  label="Previous response version"
                  tooltip="Previous version"
                  onClick={() => onSwitchVersion && onSwitchVersion(-1)}
                  disabled={currentIdx === 0}
                  className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full p-1.5 text-[#aaa0a0] transition-colors hover:text-black disabled:opacity-30 sm:min-h-0 sm:min-w-0 sm:p-1"
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={2.35} />
                </MessageActionButton>
                <span className="w-7 text-center text-[11px] font-semibold text-[#8f8989]">
                  {currentIdx + 1} / {totalVersions}
                </span>
                <MessageActionButton
                  label="Next response version"
                  tooltip="Next version"
                  onClick={() => onSwitchVersion && onSwitchVersion(1)}
                  disabled={currentIdx === totalVersions - 1}
                  className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full p-1.5 text-[#aaa0a0] transition-colors hover:text-black disabled:opacity-30 sm:min-h-0 sm:min-w-0 sm:p-1"
                >
                  <ChevronRight className="w-4 h-4" strokeWidth={2.35} />
                </MessageActionButton>
              </div>
            )}

            <MessageActionButton
              label={copied ? 'Copied' : 'Copy response'}
              tooltip={copied ? 'Copied' : 'Copy response'}
              onClick={handleCopy}
              className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-full p-2 text-[#aaa0a0] transition-colors hover:text-black sm:min-h-0 sm:min-w-0 sm:p-1"
            >
              <CopyActionIcon copied={copied} className="h-4 w-4" />
            </MessageActionButton>
            {!isUser && (
              <>
                <MessageActionButton
                  label="Like response"
                  tooltip={feedbackRating === 'like' ? 'Feedback saved' : 'Like response'}
                  className={`relative inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-full p-2 transition-colors after:absolute after:-inset-1 after:content-[''] sm:min-h-0 sm:min-w-0 sm:p-1 ${feedbackRating === 'like' ? 'text-[var(--deepchat-accent)] dark:text-[var(--deepchat-accent-text)]' : 'text-[#aaa0a0] hover:text-black'}`}
                  ariaPressed={feedbackRating === 'like'}
                  onClick={onLike}
                >
                  {feedbackRating === 'like'
                    ? <ThumbsUpFill className="h-4 w-4" />
                    : <ThumbsUp className="h-4 w-4" />}
                </MessageActionButton>
                <MessageActionButton
                  label="Dislike response"
                  tooltip={feedbackRating === 'dislike' ? 'Feedback saved' : 'Dislike response'}
                  className={`relative inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-full p-2 transition-colors after:absolute after:-inset-1 after:content-[''] sm:min-h-0 sm:min-w-0 sm:p-1 ${feedbackRating === 'dislike' ? 'text-[var(--deepchat-accent)] dark:text-[var(--deepchat-accent-text)]' : 'text-[#aaa0a0] hover:text-black'}`}
                  ariaPressed={feedbackRating === 'dislike'}
                  onClick={onDislike}
                >
                  {feedbackRating === 'dislike'
                    ? <ThumbsDownFill className="h-4 w-4" />
                    : <ThumbsDown className="h-4 w-4" />}
                </MessageActionButton>
              </>
            )}
            {onRegenerate && (
              <MessageActionButton
                label="Regenerate response"
                tooltip="Regenerate response"
                onClick={onRegenerate}
                className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-full p-2 text-[#aaa0a0] transition-colors hover:text-black sm:min-h-0 sm:min-w-0 sm:p-1"
              >
                <RefreshCw className="h-4 w-4" strokeWidth={2} />
              </MessageActionButton>
            )}
            {searchSources.length > 0 && onOpenSearchResults && (
              <button
                type="button"
                onClick={handleOpenThisSearchSidebar}
                aria-expanded={isSearchSidebarOpen}
                className={`ml-1 inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  isSearchSidebarOpen
                    ? 'bg-[var(--dc-surface-hover)] text-[var(--dc-text-strong)]'
                    : 'text-[var(--dc-text-muted)] hover:bg-[var(--dc-surface-hover)] hover:text-[var(--dc-text-strong)]'
                }`}
              >
                <StackedFavicons sources={searchSources} max={3} size="sm" />
                <span>Sources</span>
              </button>
            )}
          </div>
        )}
      </div>
      <AttachmentPreviewModal
        isOpen={isAttachmentPreviewOpen}
        file={previewAttachment}
        onClose={() => setIsAttachmentPreviewOpen(false)}
        onExited={() => setPreviewAttachment(null)}
      />
    </div>
  );
}, (prev, next) => prev.message === next.message && prev.deferOffscreen === next.deferOffscreen && prev.requestedAspectRatio === next.requestedAspectRatio && prev.onOpenGeneratedImagePreview === next.onOpenGeneratedImagePreview && prev.canEditUserMessage === next.canEditUserMessage && prev.onEditUserMessage === next.onEditUserMessage && prev.isMobileActionsOpen === next.isMobileActionsOpen && prev.feedbackRating === next.feedbackRating && prev.isSearchSidebarOpen === next.isSearchSidebarOpen && prev.onOpenSearchResults === next.onOpenSearchResults);
