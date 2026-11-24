'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Globe } from '@/components/ui/icons';
import {
  getSourceFaviconUrl,
  getSourceHost,
  type SearchSource
} from '@/lib/search/source-display';

interface SourceFaviconProps {
  source: SearchSource;
  size?: number;
  className?: string;
}

export function SourceFavicon({ source, size = 16, className = '' }: SourceFaviconProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const host = getSourceHost(source.url) || source.url;
  const hasError = failedUrl === host;

  if (hasError) {
    return (
      <Globe
        className={`shrink-0 text-slate-400 dark:text-slate-500 ${className}`}
        style={{ width: size * 0.78, height: size * 0.78 }}
      />
    );
  }

  return (
    <Image
      src={getSourceFaviconUrl(source)}
      alt=""
      width={size}
      height={size}
      unoptimized
      onError={() => setFailedUrl(host)}
      className={`shrink-0 rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

interface StackedFaviconsProps {
  sources: SearchSource[];
  max?: number;
  size?: 'sm' | 'md';
  className?: string;
}

export function StackedFavicons({
  sources,
  max = 4,
  size = 'sm',
  className = ''
}: StackedFaviconsProps) {
  const uniqueSources: SearchSource[] = [];
  const seenHosts = new Set<string>();

  for (const source of sources) {
    const key = getSourceHost(source.url) || source.url;
    if (seenHosts.has(key)) continue;
    seenHosts.add(key);
    uniqueSources.push(source);
    if (uniqueSources.length >= max) break;
  }

  if (uniqueSources.length === 0) return null;

  const chipClass = size === 'md' ? 'h-5 w-5' : 'h-[18px] w-[18px]';
  const iconSize = size === 'md' ? 16 : 14;

  return (
    <span className={`inline-flex items-center -space-x-1.5 ${className}`} aria-hidden="true">
      {uniqueSources.map((source, index) => (
        <span
          key={`${getSourceHost(source.url)}-${index}`}
          data-favicon-chip
          style={{ zIndex: uniqueSources.length - index }}
          className={`relative flex ${chipClass} items-center justify-center overflow-hidden rounded-full bg-white ring-[1.5px] ring-[var(--dc-canvas)] shadow-xs dark:bg-slate-900`}
        >
          <SourceFavicon source={source} size={iconSize} />
        </span>
      ))}
    </span>
  );
}
