'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedChatTitleProps {
  title: string;
  chatId?: string;
}

const DELETE_STEP_MS = 28;
const PAUSE_BEFORE_TYPE_MS = 70;
const TYPE_STEP_MS = 22;

export function AnimatedChatTitle({ title, chatId }: AnimatedChatTitleProps) {
  const [displayTitle, setDisplayTitle] = useState(title);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevTitleRef = useRef(title);
  const prevChatIdRef = useRef(chatId);

  useEffect(() => {
    const chatChanged = prevChatIdRef.current !== chatId;
    const prevTitle = prevTitleRef.current;

    prevChatIdRef.current = chatId;
    prevTitleRef.current = title;

    if (chatChanged) {
      setDisplayTitle(title);
      setIsAnimating(false);
      return;
    }

    const shouldAnimate =
      prevTitle === 'New Chat' &&
      Boolean(title) &&
      title !== 'New Chat';

    if (!shouldAnimate) {
      setDisplayTitle(title);
      setIsAnimating(false);
      return;
    }

    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplayTitle(title);
      setIsAnimating(false);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let deletingText = prevTitle;
    let typedIndex = 0;

    setIsAnimating(true);

    const stepType = () => {
      if (cancelled) return;
      typedIndex += 1;
      setDisplayTitle(title.slice(0, typedIndex));
      if (typedIndex < title.length) {
        timer = setTimeout(stepType, TYPE_STEP_MS);
      } else {
        setIsAnimating(false);
      }
    };

    const stepDelete = () => {
      if (cancelled) return;
      if (deletingText.length > 0) {
        deletingText = deletingText.slice(0, -1);
        setDisplayTitle(deletingText);
        timer = setTimeout(stepDelete, DELETE_STEP_MS);
      } else {
        timer = setTimeout(stepType, PAUSE_BEFORE_TYPE_MS);
      }
    };

    timer = setTimeout(stepDelete, DELETE_STEP_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [title, chatId]);

  return (
    <span className="inline-flex min-w-0 items-center">
      <span className="truncate">{displayTitle}</span>
      {isAnimating && (
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block h-[1em] w-[1.5px] shrink-0 animate-pulse bg-current opacity-70"
        />
      )}
    </span>
  );
}
