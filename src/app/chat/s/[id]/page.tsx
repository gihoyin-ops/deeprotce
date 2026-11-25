'use client';

import React, { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import {
  forkSharedChat,
  getSharedChat,
  type StoredAttachment,
  type StoredChat,
  type StoredMessage,
} from '@/app/actions';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';
import { getComposerDisplayName, getComposerFileIcon } from '@/components/ui/ChatComposer';
import AttachmentPreviewModal from '@/components/ui/AttachmentPreviewModal';
import { AnimatedChatTitle } from '@/components/ui/AnimatedChatTitle';
import Tooltip from '@/components/ui/Tooltip';
import { prefersReducedMotion, triggerSubtleHaptic } from '@/components/mobile/gesture-utils';
import { extractGeneratedImagesFromMarkdown, type ExtractedGeneratedImage } from '@/lib/images/image-generation';
import { normalizeImageAspectRatio, type ImageAspectRatio } from '@/lib/images/image-aspect-ratio';
import type { SearchSource, SearchStatus, ThinkingStep } from '@/lib/search/source-display';
import { KineticThinkingDotIcon, ThinkingSection } from '@/components/chat/search/ThinkingSection';
import { SearchStatusIndicator } from '@/components/chat/search/SearchStatusIndicator';
import { SearchResultsSidebar } from '@/components/chat/search/SearchResultsSidebar';
import { StackedFavicons } from '@/components/chat/search/StackedFavicons';
import ImageGenerationStage from '@/components/chat/image-generation/ImageGenerationStage';
import GeneratedImagePreviewModal from '@/components/chat/image-generation/GeneratedImagePreviewModal';
import {
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Link as LinkIcon,
  Loader2,
  MessageSquare,
} from '@/components/ui/icons';
import { safeAvatarSource } from '@/lib/utils';

type AttachedFile = {
  name: string;
  ext: string;
  previewUrl?: string;
  dataUrl?: string;
  content?: string;
  size?: number;
};

type SharedMessage = {
  id: string;
  role: string;
  content?: string;
  reasoning?: string;
  reasoningDuration?: number;
  searchStatus?: SearchStatus;
  searchSources?: SearchSource[];
  readSources?: SearchSource[];
  thinkingSteps?: ThinkingStep[];
  attachedFiles?: AttachedFile[];
  imageAspectRatio?: ImageAspectRatio;
  generationMode?: string;
  isError?: boolean;
};

const normalizeAttachedFiles = (raw?: StoredAttachment[] | StoredAttachment): AttachedFile[] | undefined => {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (list.length === 0) return undefined;
  return list.map((file, idx) => ({
    name: typeof file.name === 'string' && file.name ? file.name : `Attachment ${idx + 1}`,
    ext: typeof file.ext === 'string' && file.ext ? file.ext : 'file',
    previewUrl: typeof file.previewUrl === 'string' ? file.previewUrl : undefined,
    dataUrl: typeof file.dataUrl === 'string' ? file.dataUrl : undefined,
    content: typeof file.content === 'string' ? file.content : undefined,
    size: typeof file.size === 'number' ? file.size : undefined,
  }));
};

const normalizeSharedMessage = (raw: StoredMessage, idx: number): SharedMessage => {
  const versions = Array.isArray(raw.versions) ? raw.versions : undefined;
  const currentIdx = typeof raw.currentVersionIndex === 'number' ? raw.currentVersionIndex : 0;
  const activeVersion = versions && versions.length > 0
    ? versions[Math.min(Math.max(currentIdx, 0), versions.length - 1)]
    : undefined;

  const content = typeof activeVersion?.content === 'string'
    ? activeVersion.content
    : (typeof raw.content === 'string' ? raw.content : undefined);
  const reasoning = typeof activeVersion?.reasoning === 'string'
    ? activeVersion.reasoning
    : (typeof raw.reasoning === 'string' ? raw.reasoning : undefined);
  const reasoningDuration = typeof activeVersion?.reasoningDuration === 'number'
    ? activeVersion.reasoningDuration
    : (typeof raw.reasoningDuration === 'number' ? raw.reasoningDuration : undefined);
  const searchSources = Array.isArray(activeVersion?.searchSources)
    ? (activeVersion.searchSources as SearchSource[])
    : (Array.isArray(raw.searchSources) ? (raw.searchSources as SearchSource[]) : undefined);
  const readSources = Array.isArray(activeVersion?.readSources)
    ? (activeVersion.readSources as SearchSource[])
    : (Array.isArray(raw.readSources) ? (raw.readSources as SearchSource[]) : undefined);
  const thinkingSteps = Array.isArray(activeVersion?.thinkingSteps)
    ? (activeVersion.thinkingSteps as ThinkingStep[])
    : (Array.isArray(raw.thinkingSteps) ? (raw.thinkingSteps as ThinkingStep[]) : undefined);
  const searchStatus = (activeVersion?.searchStatus ?? raw.searchStatus) as SearchStatus | undefined;

  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `shared_msg_${idx}`,
    role: typeof raw.role === 'string' ? raw.role : 'assistant',
    content,
    reasoning,
    reasoningDuration,
    searchStatus,
    searchSources,
    readSources,
    thinkingSteps,
    attachedFiles: normalizeAttachedFiles(raw.attachedFiles ?? raw.attachedFile),
    imageAspectRatio: raw.imageAspectRatio ? normalizeImageAspectRatio(String(raw.imageAspectRatio)) : undefined,
    generationMode: typeof (activeVersion?.generationMode ?? raw.generationMode) === 'string'
      ? String(activeVersion?.generationMode ?? raw.generationMode)
      : undefined,
    isError: raw.isError === true,
  };
};

export default function SharedChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [chat, setChat] = useState<StoredChat | null>(null);
  const [loading, setLoading] = useState(true);
  const [followUpDraft, setFollowUpDraft] = useState('');
  const [isContinuing, setIsContinuing] = useState(false);
  const [isDockMinimized, setIsDockMinimized] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [activeMobileActionMsgId, setActiveMobileActionMsgId] = useState<string | null>(null);
  const [searchSidebar, setSearchSidebar] = useState<{ messageId: string; sources: SearchSource[] } | null>(null);
  const [isSearchSidebarOpen, setIsSearchSidebarOpen] = useState(false);
  const [imageStudioPreview, setImageStudioPreview] = useState<{
    sessionId: number;
    image: ExtractedGeneratedImage;
  } | null>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const [activeUserMsgId, setActiveUserMsgId] = useState<string | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollBottomBtnRef = useRef<HTMLButtonElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const continueArrowRef = useRef<HTMLSpanElement>(null);
  const copyLinkIconRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let active = true;
    getSharedChat(id).then((result) => {
      if (!active) return;
      setChat(result);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const messages = useMemo<SharedMessage[]>(() => {
    if (!chat || !Array.isArray(chat.messages)) return [];
    return chat.messages.map(normalizeSharedMessage);
  }, [chat]);

  const userMessages = useMemo(() => messages.filter((m) => m.role === 'user'), [messages]);
  const showCustomScrollbar = userMessages.length >= 3;

  // GSAP entrance for messages and bottom dock
  useEffect(() => {
    if (loading || !chat || !pageRef.current) return;
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      const msgEls = gsap.utils.toArray<HTMLElement>('.dc-shared-msg');
      if (msgEls.length > 0) {
        gsap.fromTo(
          msgEls,
          { y: 14, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.42,
            stagger: 0.045,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          }
        );
      }

      if (dockRef.current) {
        gsap.fromTo(
          dockRef.current,
          { y: 18, opacity: 0, scale: 0.985 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.46,
            delay: 0.12,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          }
        );
      }
    }, pageRef);

    return () => ctx.revert();
  }, [loading, chat]);

  // Animate dock minimize/expand smoothly
  useEffect(() => {
    if (!dockRef.current || prefersReducedMotion()) return;
    gsap.fromTo(
      dockRef.current,
      { y: 8, opacity: 0.75, scale: 0.98 },
      { y: 0, opacity: 1, scale: 1, duration: 0.28, ease: 'power3.out', clearProps: 'transform,opacity' }
    );
  }, [isDockMinimized]);

  // Scroll tracking for mobile scroll-to-bottom pill & desktop dot indicator
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBottomBtn(distFromBottom > 180);

      if (userMessages.length >= 3) {
        const containerRect = el.getBoundingClientRect();
        const midY = containerRect.top + containerRect.height * 0.45;
        let closestId: string | null = null;
        let closestDist = Infinity;
        for (const m of userMessages) {
          const node = document.getElementById(`msg-${m.id}`);
          if (!node) continue;
          const dist = Math.abs(node.getBoundingClientRect().top - midY);
          if (dist < closestDist) {
            closestDist = dist;
            closestId = m.id;
          }
        }
        if (closestId) setActiveUserMsgId(closestId);
      }
    };

    handleScroll();
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [userMessages]);

  useEffect(() => {
    const btn = scrollBottomBtnRef.current;
    if (!btn || prefersReducedMotion()) return;
    gsap.to(btn, {
      scale: showScrollBottomBtn ? 1 : 0.85,
      opacity: showScrollBottomBtn ? 1 : 0,
      duration: 0.22,
      ease: 'power2.out',
    });
  }, [showScrollBottomBtn]);

  const handleCopyLink = useCallback(() => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
    triggerSubtleHaptic(6);
    setLinkCopied(true);
    if (copyLinkIconRef.current && !prefersReducedMotion()) {
      gsap.fromTo(
        copyLinkIconRef.current,
        { scale: 0.75, rotate: -10 },
        { scale: 1, rotate: 0, duration: 0.3, ease: 'back.out(2)' }
      );
    }
    toast.success('Share link copied');
    setTimeout(() => setLinkCopied(false), 2000);
  }, []);

  const handleContinueChat = useCallback(
    async (withDraft?: string) => {
      if (!chat || isContinuing) return;
      setIsContinuing(true);
      triggerSubtleHaptic(8);
      try {
        const newChatId = await forkSharedChat(chat);
        const draft = (withDraft ?? followUpDraft).trim();
        const query = draft ? `?draft=${encodeURIComponent(draft)}` : '';
        router.push(`/chat/${newChatId}${query}`);
      } catch {
        toast.error('Could not continue chat');
        setIsContinuing(false);
      }
    },
    [chat, followUpDraft, isContinuing, router]
  );

  const handleToggleSearchSidebar = useCallback((messageId: string, sources: SearchSource[]) => {
    setSearchSidebar((prev) => {
      if (prev && prev.messageId === messageId && isSearchSidebarOpen) {
        setIsSearchSidebarOpen(false);
        return prev;
      }
      setIsSearchSidebarOpen(true);
      return { messageId, sources };
    });
  }, [isSearchSidebarOpen]);

  if (loading) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center bg-[var(--dc-canvas)]">
        <KineticThinkingDotIcon active hovered={false} />
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex flex-1 min-h-0 flex-col items-center justify-center bg-[var(--dc-canvas)] px-6 text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--dc-border)] bg-[var(--dc-surface)] text-[var(--dc-text-muted)]">
          <MessageSquare className="h-6 w-6" />
        </div>
        <h1 className="mb-2 text-[22px] font-semibold tracking-tight text-[var(--dc-text-strong)]">
          Chat not found
        </h1>
        <p className="mb-7 max-w-sm text-[14.5px] leading-relaxed text-[var(--dc-text-muted)]">
          This shared conversation may have been removed or the link is no longer valid.
        </p>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--dc-invert)] px-5 text-[13.5px] font-medium text-[var(--dc-text-on-invert)] transition-transform hover:bg-[var(--dc-invert-hover)] active:scale-[0.97]"
        >
          Back to DeepChat
        </Link>
      </div>
    );
  }

  const ownerProfile = chat.ownerProfile || { name: 'User', avatar: '', plan: '' };
  const ownerAvatar = safeAvatarSource(ownerProfile.avatar);
  const ownerName = ownerProfile.name || 'User';
  const chatTitle = chat.title || 'Shared Chat';

  return (
    <div
      ref={pageRef}
      className="deepchat-chat-view relative flex min-h-0 flex-1 flex-row overflow-hidden bg-[var(--dc-canvas)] text-[var(--dc-text)]"
    >
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Desktop Top Bar (matches ChatView) */}
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 z-10 hidden h-16 items-start justify-between px-5 pt-3.5 sm:flex"
          style={{
            background:
              'linear-gradient(to bottom, var(--dc-canvas) 0%, var(--dc-canvas) 52%, transparent 100%)',
          }}
        >
          <h1 className="pointer-events-auto truncate pr-4 text-[15px] font-semibold tracking-[-0.01em] text-[var(--dc-text-strong)]">
            <AnimatedChatTitle title={chatTitle} chatId={id} />
          </h1>

          <div className="pointer-events-auto flex shrink-0 items-center gap-2.5">
            <div className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--dc-text-muted)]">
              <Image
                src={ownerAvatar}
                alt={ownerName}
                width={20}
                height={20}
                unoptimized
                className="h-5 w-5 rounded-full object-cover ring-1 ring-[var(--dc-border)]"
              />
              <span className="max-w-[140px] truncate">{ownerName}</span>
            </div>

            <Tooltip label={linkCopied ? 'Copied' : 'Copy link'} side="bottom">
              <button
                type="button"
                onClick={handleCopyLink}
                aria-label="Copy share link"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-fill)] hover:text-[var(--dc-text-strong)] active:scale-95"
              >
                <span ref={copyLinkIconRef} className="inline-flex items-center justify-center">
                  {linkCopied ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                </span>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Message List */}
        <div
          ref={scrollContainerRef}
          className={`flex-1 overflow-y-auto px-4 pb-4 pt-[calc(env(safe-area-inset-top,0px)+4rem)] sm:px-8 sm:pb-6 sm:pt-16 ${
            showCustomScrollbar
              ? '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
              : 'custom-scrollbar'
          }`}
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-28 sm:gap-7 sm:pb-32">
            {messages.map((msg, idx) => {
              let requestedAspectRatio = msg.imageAspectRatio;
              if (!requestedAspectRatio && msg.role === 'assistant') {
                for (let i = idx - 1; i >= 0; i -= 1) {
                  if (messages[i]?.role === 'user') {
                    requestedAspectRatio = messages[i]?.imageAspectRatio;
                    break;
                  }
                }
              }

              return (
                <SharedMessageBubble
                  key={msg.id}
                  message={msg}
                  requestedAspectRatio={requestedAspectRatio}
                  isMobileActionsOpen={activeMobileActionMsgId === msg.id}
                  onActivateMobileActions={() => setActiveMobileActionMsgId(msg.id)}
                  onOpenGeneratedImagePreview={(image) =>
                    setImageStudioPreview({ sessionId: Date.now(), image })
                  }
                  isSearchSidebarOpen={isSearchSidebarOpen && searchSidebar?.messageId === msg.id}
                  onOpenSearchResults={handleToggleSearchSidebar}
                />
              );
            })}

            {messages.length > 0 && (
              <div className="pt-2 pb-0 text-center">
                <p className="inline-flex px-3 text-[11.5px] font-normal text-[var(--dc-text-muted)] sm:text-[12px]">
                  Shared conversation · Read-only snapshot
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
          style={{ bottom: isDockMinimized ? 76 : 96 }}
          className={`fixed right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)]/95 text-[var(--dc-text-strong)] shadow-lg backdrop-blur-md transition-transform active:scale-90 sm:hidden ${
            showScrollBottomBtn ? 'pointer-events-auto' : 'pointer-events-none opacity-0'
          }`}
        >
          <ChevronDown className="h-5 w-5" strokeWidth={2.25} />
        </button>

        {/* Desktop Dot Jump Scrollbar */}
        {showCustomScrollbar && (
          <div className="absolute right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center justify-center sm:flex">
            <div className="rounded-full border border-slate-200/60 bg-slate-200/30 px-2 py-4 shadow-sm backdrop-blur-sm transition-colors hover:bg-slate-200/50 dark:border-slate-700/70 dark:bg-slate-950/80 dark:shadow-black/30 dark:hover:bg-slate-900/90">
              <div className="flex max-h-[100px] w-full flex-col items-center gap-3 overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {userMessages.map((m, idx) => {
                  const isActive = activeUserMsgId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      title={`Jump to message ${idx + 1}`}
                      onClick={() =>
                        document
                          .getElementById(`msg-${m.id}`)
                          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }
                      className={`shrink-0 rounded-full shadow-sm transition-all duration-300 ${
                        isActive
                          ? 'h-3 w-3 scale-110 bg-slate-800 ring-2 ring-slate-300/70 dark:bg-slate-300 dark:ring-slate-600/70'
                          : 'h-2 w-2 bg-slate-300 hover:scale-125 hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-300'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Floating Dock: Continue or Just View */}
        <div className="pointer-events-none absolute bottom-0 left-0 z-20 flex w-full flex-col items-center bg-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-8 sm:pb-5 sm:pt-2">
          <div
            ref={dockRef}
            className={`pointer-events-auto flex w-full justify-center ${
              isDockMinimized ? 'max-w-fit' : 'max-w-[40rem] sm:max-w-[48rem]'
            }`}
          >
            {isDockMinimized ? (
              <div className="flex items-center gap-1.5 rounded-full border border-[var(--dc-border)] bg-[var(--dc-surface)]/92 p-1.5 pl-3 shadow-lg shadow-black/[0.06] backdrop-blur-xl dark:shadow-black/35">
                <button
                  type="button"
                  onClick={() => {
                    triggerSubtleHaptic(6);
                    setIsDockMinimized(false);
                  }}
                  className="cursor-pointer text-[12.5px] font-medium text-[var(--dc-text-muted)] transition-colors hover:text-[var(--dc-text-strong)]"
                >
                  Viewing only
                </button>
                <button
                  type="button"
                  disabled={isContinuing}
                  onClick={() => void handleContinueChat()}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--dc-invert)] px-3.5 text-[12.5px] font-medium text-[var(--dc-text-on-invert)] transition-all hover:bg-[var(--dc-invert-hover)] active:scale-[0.97] disabled:opacity-60"
                >
                  {isContinuing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5" />
                  )}
                  <span>Continue</span>
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleContinueChat(followUpDraft);
                }}
                className="flex w-full items-center gap-2 rounded-[22px] border border-[var(--dc-border)] bg-[var(--dc-surface)]/92 px-3 py-2 shadow-lg shadow-black/[0.05] backdrop-blur-xl transition-colors focus-within:border-[var(--dc-border-strong)] dark:shadow-black/30 sm:rounded-[26px] sm:px-4 sm:py-2.5"
              >
                <input
                  type="text"
                  value={followUpDraft}
                  onChange={(e) => setFollowUpDraft(e.target.value)}
                  disabled={isContinuing}
                  placeholder="Ask a follow-up to continue this chat..."
                  aria-label="Ask a follow-up to continue this chat"
                  className="min-w-0 flex-1 bg-transparent px-1 text-[14.5px] font-normal text-[var(--dc-text-strong)] outline-none placeholder:text-[var(--dc-text-placeholder)] sm:text-[15px]"
                />

                <div className="flex shrink-0 items-center gap-1.5">
                  <Tooltip label="Minimize bar (view only)" side="top">
                    <button
                      type="button"
                      onClick={() => {
                        triggerSubtleHaptic(5);
                        setIsDockMinimized(true);
                      }}
                      aria-label="Minimize bar"
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--dc-text-muted)] transition-colors hover:bg-[var(--dc-fill)] hover:text-[var(--dc-text-strong)] active:scale-90"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </Tooltip>

                  {followUpDraft.trim().length > 0 ? (
                    <button
                      type="submit"
                      disabled={isContinuing}
                      aria-label="Continue with message"
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[var(--dc-invert)] text-[var(--dc-text-on-invert)] transition-all hover:bg-[var(--dc-invert-hover)] active:scale-90 disabled:opacity-50"
                    >
                      {isContinuing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isContinuing}
                      onClick={() => void handleContinueChat()}
                      onMouseEnter={() => {
                        if (continueArrowRef.current && !prefersReducedMotion()) {
                          gsap.to(continueArrowRef.current, { x: 2.5, duration: 0.2, ease: 'power2.out' });
                        }
                      }}
                      onMouseLeave={() => {
                        if (continueArrowRef.current && !prefersReducedMotion()) {
                          gsap.to(continueArrowRef.current, { x: 0, duration: 0.2, ease: 'power2.out' });
                        }
                      }}
                      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--dc-invert)] px-4 text-[13px] font-medium text-[var(--dc-text-on-invert)] transition-all hover:bg-[var(--dc-invert-hover)] active:scale-[0.97] disabled:opacity-60"
                    >
                      <span>{isContinuing ? 'Opening...' : 'Continue'}</span>
                      <span ref={continueArrowRef} className="inline-flex items-center">
                        {isContinuing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5" />
                        )}
                      </span>
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>

        {imageStudioPreview && (
          <GeneratedImagePreviewModal
            key={`shared-img-${imageStudioPreview.sessionId}`}
            isOpen
            image={imageStudioPreview.image}
            initialMode="view"
            isBusy={false}
            onClose={() => setImageStudioPreview(null)}
            onSubmitEdit={async () => {}}
          />
        )}
      </div>

      {searchSidebar && (
        <SearchResultsSidebar
          open={isSearchSidebarOpen}
          sources={searchSidebar.sources}
          messageId={searchSidebar.messageId}
          onClose={() => setIsSearchSidebarOpen(false)}
          onExited={() => setSearchSidebar(null)}
        />
      )}
    </div>
  );
}

function SharedMessageBubble({
  message,
  requestedAspectRatio,
  isMobileActionsOpen,
  onActivateMobileActions,
  onOpenGeneratedImagePreview,
  isSearchSidebarOpen,
  onOpenSearchResults,
}: {
  message: SharedMessage;
  requestedAspectRatio?: ImageAspectRatio;
  isMobileActionsOpen: boolean;
  onActivateMobileActions: () => void;
  onOpenGeneratedImagePreview: (image: ExtractedGeneratedImage, index: number) => void;
  isSearchSidebarOpen: boolean;
  onOpenSearchResults: (messageId: string, sources: SearchSource[]) => void;
}) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const copyIconRef = useRef<HTMLSpanElement>(null);
  const [previewAttachment, setPreviewAttachment] = useState<AttachedFile | null>(null);
  const [isAttachmentPreviewOpen, setIsAttachmentPreviewOpen] = useState(false);

  const searchSources = useMemo(() => message.searchSources ?? [], [message.searchSources]);
  const mainAssistantContent = !isUser ? (message.content || '') : '';
  const hasReasoningBlock = !isUser && (
    Boolean(message.reasoning) ||
    Boolean(message.thinkingSteps && message.thinkingSteps.some((step) => step.type === 'thought'))
  );
  const hasStandaloneSearch = !isUser && !hasReasoningBlock && searchSources.length > 0;

  const extractedImageContent = useMemo(
    () => extractGeneratedImagesFromMarkdown(mainAssistantContent),
    [mainAssistantContent]
  );
  const hasGeneratedImages = !isUser && !message.isError && extractedImageContent.images.length > 0;
  const useImageStudioStage =
    !isUser &&
    !message.isError &&
    (!message.reasoning || hasGeneratedImages) &&
    ((message.generationMode === 'image' && hasGeneratedImages) ||
      (hasGeneratedImages && !extractedImageContent.remainingText));

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content || '');
    setCopied(true);
    triggerSubtleHaptic(5);
    if (copyIconRef.current && !prefersReducedMotion()) {
      gsap.fromTo(
        copyIconRef.current,
        { scale: 0.72 },
        { scale: 1, duration: 0.28, ease: 'back.out(2.2)' }
      );
    }
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id={`msg-${message.id}`}
      onClick={onActivateMobileActions}
      className={`dc-shared-msg group/message flex w-full items-start ${
        isUser ? 'justify-end message-user' : 'justify-start'
      }`}
    >
      <div
        className={`relative flex min-w-0 flex-col ${
          isUser
            ? 'max-w-[78%] items-end sm:max-w-[52%]'
            : 'w-full max-w-[44rem] items-start sm:max-w-[48rem]'
        }`}
      >
        {hasReasoningBlock && (
          <ThinkingSection
            content={message.reasoning || ''}
            isStreaming={false}
            duration={message.reasoningDuration}
            searchStatus={message.searchStatus}
            searchSources={searchSources}
            readSources={message.readSources}
            thinkingSteps={message.thinkingSteps}
            answerContent={mainAssistantContent}
            isSidebarOpen={isSearchSidebarOpen}
            onOpenSearchResults={
              searchSources.length > 0
                ? () => onOpenSearchResults(message.id, searchSources)
                : undefined
            }
          />
        )}

        {hasStandaloneSearch && (
          <SearchStatusIndicator
            status={message.searchStatus}
            sources={searchSources}
            isSidebarOpen={isSearchSidebarOpen}
            onOpenSearchResults={() => onOpenSearchResults(message.id, searchSources)}
          />
        )}

        {isUser && message.attachedFiles && message.attachedFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap justify-end gap-2">
            {message.attachedFiles.map((file, idx) => {
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
              isGenerating={false}
              images={extractedImageContent.images}
              requestedAspectRatio={requestedAspectRatio ?? message.imageAspectRatio}
              onPreviewImage={(img, index) => onOpenGeneratedImagePreview(img, index)}
            />
            {extractedImageContent.remainingText && (
              <div className="mt-3 max-w-full px-0 py-0 text-black dark:text-slate-100">
                <MarkdownRenderer
                  content={extractedImageContent.remainingText}
                  searchSources={searchSources}
                />
              </div>
            )}
          </div>
        ) : isUser ? (
          <div className="max-w-full rounded-[20px] rounded-br-[6px] border border-[var(--dc-border-subtle)] bg-[var(--dc-fill)] px-4 py-2.5 text-[var(--dc-text-strong)] shadow-none sm:rounded-[1.65rem] sm:border-0 sm:bg-[#aeeefa] sm:px-5 sm:py-3.5 dark:text-slate-100 dark:sm:!bg-[var(--dc-user-bubble-sm)]">
            <div className="whitespace-pre-wrap break-words text-[15.5px] font-medium leading-[1.55] sm:text-[17px] sm:leading-relaxed">
              {message.content}
            </div>
          </div>
        ) : mainAssistantContent ? (
          <div
            className={`max-w-full ${
              message.isError
                ? 'px-1 py-1 text-red-600'
                : 'px-0 py-0 text-black dark:text-slate-100'
            }`}
          >
            <MarkdownRenderer content={mainAssistantContent} searchSources={searchSources} />
          </div>
        ) : null}

        {isUser && message.content && (
          <div
            className={`mt-1 max-w-full flex-wrap items-center justify-end gap-1 transition-opacity duration-200 sm:pointer-events-none sm:absolute sm:right-0 sm:top-full sm:mt-0 sm:flex sm:h-7 sm:min-h-0 sm:gap-1.5 sm:pt-1 sm:opacity-0 sm:group-hover/message:pointer-events-auto sm:group-hover/message:opacity-100 ${
              isMobileActionsOpen
                ? 'pointer-events-auto flex min-h-9 opacity-100'
                : 'pointer-events-none hidden opacity-0'
            }`}
          >
            <Tooltip label={copied ? 'Copied' : 'Copy message'} side="bottom">
              <button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? 'Copied' : 'Copy message'}
                className="inline-flex min-h-[38px] min-w-[38px] cursor-pointer items-center justify-center rounded-full p-2 text-[#aaa0a0] transition-colors hover:text-[var(--dc-text-strong)] sm:min-h-0 sm:min-w-0 sm:p-1"
              >
                <span ref={copyIconRef} className="inline-flex items-center justify-center">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </span>
              </button>
            </Tooltip>
          </div>
        )}

        {!isUser && message.content && (
          <div
            className={`mt-1.5 ml-0 flex min-h-8 max-w-full flex-wrap items-center gap-1 transition-opacity duration-200 sm:pointer-events-none sm:absolute sm:left-0 sm:top-full sm:mt-0 sm:min-h-7 sm:gap-1.5 sm:pt-1.5 sm:opacity-0 sm:group-hover/message:pointer-events-auto sm:group-hover/message:opacity-100 ${
              isMobileActionsOpen
                ? 'pointer-events-auto opacity-100'
                : 'pointer-events-auto opacity-100 sm:pointer-events-none sm:opacity-0'
            }`}
          >
            <Tooltip label={copied ? 'Copied' : 'Copy response'} side="bottom">
              <button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? 'Copied' : 'Copy response'}
                className="inline-flex min-h-[38px] min-w-[38px] cursor-pointer items-center justify-center rounded-full p-2 text-[#aaa0a0] transition-colors hover:text-[var(--dc-text-strong)] sm:min-h-0 sm:min-w-0 sm:p-1"
              >
                <span ref={copyIconRef} className="inline-flex items-center justify-center">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </span>
              </button>
            </Tooltip>

            {searchSources.length > 0 && (
              <button
                type="button"
                onClick={() => onOpenSearchResults(message.id, searchSources)}
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
}
