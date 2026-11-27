'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText } from '@/components/ui/icons';

const pdfCoverCache = new Map<string, string>();

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const extractBase64FromDataUrl = (url: string): string | null => {
  const match = url.match(/^data:[^;]*;base64,([A-Za-z0-9+/=]+)$/);
  return match ? match[1] : null;
};

export default function PdfCoverThumbnail({
  src,
  alt,
  className = 'h-full w-full object-cover object-top'
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const cacheKey = src || '';
  const [rendered, setRendered] = useState<{ key: string; dataUrl: string } | null>(null);
  const [failedKey, setFailedKey] = useState('');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const previewId = useMemo(() => {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }, []);

  const coverUrl =
    (cacheKey && pdfCoverCache.get(cacheKey)) ||
    (rendered && rendered.key === cacheKey ? rendered.dataUrl : '');

  const isFailed = Boolean(cacheKey && failedKey === cacheKey);

  useEffect(() => {
    if (!cacheKey || coverUrl || isFailed) return;
    let active = true;

    const handleMessage = async (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== 'deepchat-python-sandbox') return;
      if (!iframeRef.current?.contentWindow || event.source !== iframeRef.current.contentWindow) return;

      if (data.type === 'ready') {
        try {
          let base64 = cacheKey.startsWith('data:') ? extractBase64FromDataUrl(cacheKey) : null;
          if (!base64) {
            const res = await fetch(cacheKey, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = await res.arrayBuffer();
            if (buf.byteLength === 0 || buf.byteLength > 15 * 1024 * 1024) {
              throw new Error('PDF out of range');
            }
            base64 = arrayBufferToBase64(buf);
          }
          if (!active || !iframeRef.current?.contentWindow) return;
          iframeRef.current.contentWindow.postMessage(
            {
              source: 'deepchat-python-host',
              type: 'render_pdf_cover',
              previewId,
              base64
            },
            '*'
          );
        } catch {
          if (active) setFailedKey(cacheKey);
        }
        return;
      }

      if (data.previewId !== previewId) return;

      if (data.type === 'pdf_cover' && typeof data.dataUrl === 'string' && data.dataUrl.startsWith('data:image/')) {
        pdfCoverCache.set(cacheKey, data.dataUrl);
        if (active) setRendered({ key: cacheKey, dataUrl: data.dataUrl });
      } else if (data.type === 'pdf_cover_error') {
        if (active) setFailedKey(cacheKey);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      active = false;
      window.removeEventListener('message', handleMessage);
    };
  }, [cacheKey, coverUrl, isFailed, previewId]);

  if (coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={coverUrl} alt={alt} className={className} />
    );
  }

  return (
    <>
      <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />
      {cacheKey && !isFailed && (
        <iframe
          ref={iframeRef}
          title="PDF cover renderer"
          sandbox="allow-scripts"
          src="/python-sandbox"
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px border-0 opacity-0"
        />
      )}
    </>
  );
}
