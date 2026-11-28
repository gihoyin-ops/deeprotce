'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import toast from 'react-hot-toast';
import { createChat, getUserProfile, uploadFile } from './actions';
import ChatComposer from '@/components/ui/ChatComposer';
import DotRevealHeadline from '@/components/home/DotRevealHeadline';
import {
  ACTIVE_PRODUCT_ANNOUNCEMENT,
  ProductAnnouncementCard,
  type ProductAnnouncementActionType,
} from '@/components/notify_annouce_products';
import { defaultComposerToolState, loadComposerToolState, saveComposerToolState } from '@/lib/agent/composer-tool-state';
import { type ImageAspectRatio } from '@/lib/images/image-aspect-ratio';

interface AttachedFile {
  name: string;
  ext: string;
  previewUrl?: string;
  storageKey?: string;
  dataUrl?: string;
  content?: string;
  size?: number;
}

interface UserProfile {
  name?: string;
}

const canPreviewUploadFile = (file: File) =>
  file.type.startsWith('image/') ||
  file.type === 'application/pdf' ||
  file.type.startsWith('video/') ||
  file.type.startsWith('audio/') ||
  /\.(png|jpe?g|gif|webp|svg|bmp|heic|heif|avif|pdf|mp4|webm|mov|mp3|wav|ogg|m4a)$/i.test(file.name);
const createAttachedPreviewUrl = (file: File) => canPreviewUploadFile(file) ? URL.createObjectURL(file) : undefined;
const revokeAttachedPreview = (file: AttachedFile) => {
  if (file.previewUrl && file.previewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(file.previewUrl);
  }
};
const stripAttachedPreview = (file: AttachedFile) => {
  const remoteUrl = file.previewUrl && /^https?:\/\//i.test(file.previewUrl) ? file.previewUrl : undefined;
  return {
    name: file.name,
    ext: file.ext,
    previewUrl: remoteUrl,
    storageKey: file.storageKey,
    dataUrl: remoteUrl ? undefined : file.dataUrl,
    content: file.content,
    size: file.size
  };
};

const homeHeadlines = [
  (name: string) => `Hello ${name}, What can I help you today?`,
  () => 'Bring your ideas with our programs',
  () => 'Step first to a Agent AI',
  () => 'Turn your questions into clear answers',
  () => 'Build something useful with Benthos',
  () => 'Explore smarter ways to get work done',
  () => 'Start a new thought with Benthos'
];

const pickHeadlineIndex = (currentIndex?: number) => {
  const nextIndex = Math.floor(Math.random() * homeHeadlines.length);
  if (typeof currentIndex !== 'number' || homeHeadlines.length < 2 || nextIndex !== currentIndex) return nextIndex;
  return (nextIndex + 1) % homeHeadlines.length;
};

export default function WelcomePage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [profileName, setProfileName] = useState('Guest');
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [webSearchEnabled, setWebSearchEnabled] = useState(defaultComposerToolState.webSearchEnabled);
  const [imageGenerationEnabled, setImageGenerationEnabled] = useState(defaultComposerToolState.imageGenerationEnabled);
  const [imageAspectRatio, setImageAspectRatio] = useState<ImageAspectRatio>(defaultComposerToolState.imageAspectRatio);
  const [isClientStateLoaded, setIsClientStateLoaded] = useState(false);
  const [announcementState, setAnnouncementState] = useState({ checked: false, open: false });
  const composerWrapRef = useRef<HTMLDivElement>(null);
  const composerPulseRef = useRef<HTMLDivElement>(null);
  const headline = homeHeadlines[headlineIndex](profileName || 'Guest');

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      setInput(localStorage.getItem('deepchat-draft-new') || '');
      const toolState = loadComposerToolState();
      setWebSearchEnabled(toolState.webSearchEnabled);
      setImageGenerationEnabled(toolState.imageGenerationEnabled);
      setImageAspectRatio(toolState.imageAspectRatio);
      setHeadlineIndex(current => pickHeadlineIndex(current));
      setIsClientStateLoaded(true);
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadProfile = () => getUserProfile().then((profile) => {
      const savedProfile = profile as UserProfile;
      if (mounted) setProfileName(savedProfile.name || 'Guest');
    });
    void loadProfile();
    const refreshHome = () => {
      setInput('');
      setAttachedFiles(prev => {
        prev.forEach(revokeAttachedPreview);
        return [];
      });
      setHeadlineIndex(current => pickHeadlineIndex(current));
    };
    const refreshProfile = () => {
      void loadProfile();
      setHeadlineIndex(current => pickHeadlineIndex(current));
    };
    window.addEventListener('deepchat:new-home-prompt', refreshHome);
    window.addEventListener('profileUpdated', refreshProfile);
    return () => {
      mounted = false;
      window.removeEventListener('deepchat:new-home-prompt', refreshHome);
      window.removeEventListener('profileUpdated', refreshProfile);
    };
  }, []);

  useEffect(() => {
    if (!isClientStateLoaded) return;
    localStorage.setItem('deepchat-draft-new', input);
  }, [input, isClientStateLoaded]);

  useEffect(() => {
    if (!isClientStateLoaded) return;
    saveComposerToolState({ webSearchEnabled, imageGenerationEnabled, imageAspectRatio });
  }, [webSearchEnabled, imageGenerationEnabled, imageAspectRatio, isClientStateLoaded]);

  useEffect(() => {
    const wrapEl = composerWrapRef.current;
    if (!isClientStateLoaded || !wrapEl) return;

    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: reduce)', () => {
      wrapEl.classList.remove('dc-home-reveal-hidden');
      gsap.set(wrapEl, { opacity: 1, y: 0 });
    });

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      wrapEl.classList.remove('dc-home-reveal-hidden');
      gsap.fromTo(
        wrapEl,
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: 0.56,
          delay: 0.14,
          ease: 'expo.out',
          clearProps: 'transform',
        }
      );
    });

    return () => {
      wrapEl.classList.add('dc-home-reveal-hidden');
      mm.revert();
    };
  }, [isClientStateLoaded]);

  const focusComposerInput = useCallback((withPulse = true) => {
    window.requestAnimationFrame(() => {
      const textarea = composerWrapRef.current?.querySelector('textarea');
      if (textarea) {
        textarea.focus();
        const len = textarea.value.length;
        textarea.setSelectionRange(len, len);
      }
    });

    const pulseEl = composerPulseRef.current;
    if (withPulse && pulseEl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.killTweensOf(pulseEl);
      gsap.fromTo(
        pulseEl,
        { opacity: 0, scale: 0.99 },
        {
          opacity: 0.85,
          scale: 1,
          duration: 0.24,
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
          clearProps: 'opacity,transform',
        }
      );
    }
  }, []);

  useEffect(() => {
    const activateImageTool = () => {
      setWebSearchEnabled(false);
      setImageGenerationEnabled(true);
      focusComposerInput(true);
    };
    window.addEventListener('deepchat:activate-image-tool', activateImageTool);
    return () => window.removeEventListener('deepchat:activate-image-tool', activateImageTool);
  }, [focusComposerInput]);

  const handleAnnouncementOpenState = useCallback(
    (state: { checked: boolean; open: boolean }) => {
      setAnnouncementState(state);
    },
    []
  );

  const handleAnnouncementAction = useCallback((action: ProductAnnouncementActionType) => {
    if (action === 'enable-web-search') {
      setImageGenerationEnabled(false);
      setWebSearchEnabled(true);
      focusComposerInput(true);
      return;
    }
    if (action === 'enable-image') {
      setWebSearchEnabled(false);
      setImageGenerationEnabled(true);
      focusComposerInput(true);
      return;
    }
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('openModelSelector'));
    });
  }, [focusComposerInput]);

  const handleFilesUpload = async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const previewUrl = createAttachedPreviewUrl(file);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await uploadFile(formData);
        if (res.success && res.fileName) {
          if (res.previewUrl && previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
          }
          setAttachedFiles(prev => [...prev, {
            name: res.fileName!,
            ext: res.ext || 'other',
            previewUrl: res.previewUrl || previewUrl,
            storageKey: res.storageKey,
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

  const startChat = async (inputMsg?: string, files: AttachedFile[] = attachedFiles, useWebSearch = webSearchEnabled, useImageGeneration = imageGenerationEnabled, selectedImageAspectRatio = imageAspectRatio) => {
    localStorage.removeItem('deepchat-draft-new');
    const cleanFiles = files.map(stripAttachedPreview);
    const id = await createChat('New Chat', cleanFiles);
    if (cleanFiles.length > 0) {
      try {
        sessionStorage.setItem(`deepchat-pending-files-${id}`, JSON.stringify(cleanFiles));
      } catch {
        // Ignore sessionStorage quota/availability errors
      }
    }
    const query = new URLSearchParams();
    if (inputMsg || files.length > 0) query.set('msg', inputMsg || '');
    if (useWebSearch) query.set('web', '1');
    if (useImageGeneration) {
      query.set('image', '1');
      query.set('ratio', selectedImageAspectRatio);
    }
    const qString = query.toString();
    files.forEach(revokeAttachedPreview);
    router.push(`/chat/${id}${qString ? `?${qString}` : ''}`);
  };

  const isHeadlineReady = isClientStateLoaded && announcementState.checked && !announcementState.open;

  return (
    <div className="deepchat-home-light dc-home-canvas relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden custom-scrollbar">
      <ProductAnnouncementCard
        announcement={ACTIVE_PRODUCT_ANNOUNCEMENT}
        onAction={handleAnnouncementAction}
        onOpenStateChange={handleAnnouncementOpenState}
      />

      <div className="flex min-h-full w-full max-w-[46rem] flex-col items-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 sm:mx-auto sm:my-auto sm:min-h-0 sm:shrink-0 sm:px-6 sm:pb-16 sm:pt-10">
        <div className="flex w-full flex-1 flex-col items-center justify-center px-2 sm:mb-10 sm:flex-none sm:px-0">
          <DotRevealHeadline text={headline} ready={isHeadlineReady} />
        </div>

        <div ref={composerWrapRef} className="dc-home-reveal-hidden relative z-30 w-full shrink-0">
          <div
            ref={composerPulseRef}
            className="dc-composer-focus-ring pointer-events-none absolute -inset-[3px] rounded-[29px] opacity-0"
            aria-hidden="true"
          />
          <ChatComposer
            value={input}
            attachedFiles={attachedFiles}
            isUploading={isUploading}
            webSearchEnabled={webSearchEnabled}
            imageGenerationEnabled={imageGenerationEnabled}
            imageAspectRatio={imageAspectRatio}
            onChange={setInput}
            onSubmit={(value) => startChat(value)}
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
        </div>
      </div>
    </div>
  );
}
