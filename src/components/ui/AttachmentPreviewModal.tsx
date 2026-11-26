'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import NextImage from 'next/image';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import {
  BookOpen,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Video,
  Volume2,
  X,
} from '@/components/ui/icons';
import { getStoredFileClient } from '@/lib/storage/client-storage';

export interface PreviewableAttachment {
  name: string;
  ext: string;
  previewUrl?: string;
  dataUrl?: string;
  content?: string;
  size?: number;
}

interface AttachmentPreviewModalProps {
  isOpen: boolean;
  file: PreviewableAttachment | null;
  onClose: () => void;
  onExited?: () => void;
}

interface HydratedAttachmentRecord {
  key: string;
  dataUrl?: string;
  content?: string;
  size?: number;
}

interface BlobUrlState {
  source: string;
  url: string;
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'heic', 'heif', 'avif', 'ico']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac']);
const SPREADSHEET_EXTS = new Set(['csv', 'tsv', 'xls', 'xlsx', 'ods']);
const PROSE_EXTS = new Set(['txt', 'md', 'markdown', 'log', 'rtf']);
const CODE_EXTS = new Set([
  'json', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'less',
  'py', 'sql', 'xml', 'yaml', 'yml', 'sh', 'bash', 'env', 'ini', 'toml',
  'java', 'go', 'rs', 'c', 'cpp', 'h', 'hpp', 'rb', 'php', 'swift', 'kt',
  'vue', 'svelte', 'graphql', 'prisma',
]);

const DOCUMENT_LABELS: Record<string, string> = {
  pdf: 'PDF Document',
  doc: 'Word Document',
  docx: 'Word Document',
  xls: 'Excel Spreadsheet',
  xlsx: 'Excel Spreadsheet',
  ppt: 'PowerPoint Presentation',
  pptx: 'PowerPoint Presentation',
  csv: 'CSV Spreadsheet',
  tsv: 'TSV Spreadsheet',
  txt: 'Plain Text',
  md: 'Markdown Document',
  markdown: 'Markdown Document',
  json: 'JSON Data',
  xml: 'XML Document',
  yaml: 'YAML Config',
  yml: 'YAML Config',
  html: 'HTML Document',
  css: 'Stylesheet',
  js: 'JavaScript',
  jsx: 'React JSX',
  ts: 'TypeScript',
  tsx: 'React TSX',
  py: 'Python Script',
  sql: 'SQL Query',
  zip: 'ZIP Archive',
  rar: 'RAR Archive',
  '7z': '7Z Archive',
};

const MAX_CSV_ROWS = 250;
const MAX_CSV_COLS = 50;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getCleanDisplayName(name: string): string {
  const stripped = name
    .replace(/^[a-f0-9]{8}-/i, '')
    .replace(/^\d{10,14}_/, '')
    .replaceAll('_', ' ')
    .trim();
  return stripped || name;
}

function getDocumentLabel(ext: string): string {
  const normalized = ext.toLowerCase();
  if (DOCUMENT_LABELS[normalized]) return DOCUMENT_LABELS[normalized];
  if (IMAGE_EXTS.has(normalized)) return `${normalized.toUpperCase()} Image`;
  if (VIDEO_EXTS.has(normalized)) return `${normalized.toUpperCase()} Video`;
  if (AUDIO_EXTS.has(normalized)) return `${normalized.toUpperCase()} Audio`;
  if (!normalized || normalized === 'other') return 'Document';
  return `${normalized.toUpperCase()} File`;
}

function formatFileSize(bytes?: number): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    const header = dataUrl.slice(0, commaIdx);
    const body = dataUrl.slice(commaIdx + 1);
    const mimeMatch = header.match(/^data:([^;]+)/i);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    if (header.includes(';base64')) {
      const binary = atob(body);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(body)], { type: mime });
  } catch {
    return null;
  }
}

function decodeTextFromDataUrl(dataUrl: string): string | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    const header = dataUrl.slice(0, commaIdx).toLowerCase();
    const body = dataUrl.slice(commaIdx + 1);
    const looksTextual =
      header.startsWith('data:text/') ||
      header.includes('json') ||
      header.includes('xml') ||
      header.includes('javascript') ||
      header.includes('svg') ||
      header.includes('csv');
    if (!looksTextual && !header.startsWith('data:;')) return null;

    if (header.includes(';base64')) {
      const binary = atob(body);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
    return decodeURIComponent(body);
  } catch {
    return null;
  }
}

function parseDelimitedText(text: string, delimiter: string): { rows: string[][]; truncated: boolean } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let truncated = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      if (row.length < MAX_CSV_COLS) row.push(cell);
      cell = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      if (row.length < MAX_CSV_COLS) row.push(cell);
      cell = '';
      if (row.some(value => value.length > 0)) {
        rows.push(row);
        if (rows.length >= MAX_CSV_ROWS) {
          truncated = i < text.length - 1;
          break;
        }
      }
      row = [];
    } else {
      cell += ch;
    }
  }

  if (!truncated && (cell.length > 0 || row.length > 0)) {
    if (row.length < MAX_CSV_COLS) row.push(cell);
    if (row.some(value => value.length > 0)) {
      rows.push(row);
    }
  }

  return { rows, truncated };
}

function getPreviewHeaderIcon(ext: string, className: string) {
  const normalized = ext.toLowerCase();
  if (normalized === 'pdf') return <FileText className={className} />;
  if (IMAGE_EXTS.has(normalized)) return <ImageIcon className={className} />;
  if (VIDEO_EXTS.has(normalized)) return <Video className={className} />;
  if (AUDIO_EXTS.has(normalized)) return <Volume2 className={className} />;
  if (SPREADSHEET_EXTS.has(normalized)) return <FileSpreadsheet className={className} />;
  if (CODE_EXTS.has(normalized)) return <Code2 className={className} />;
  if (PROSE_EXTS.has(normalized) || normalized === 'doc' || normalized === 'docx') {
    return <BookOpen className={className} />;
  }
  return <FileIcon className={className} />;
}

export default function AttachmentPreviewModal({
  isOpen,
  file,
  onClose,
  onExited,
}: AttachmentPreviewModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const onExitedRef = useRef(onExited);
  const wasOpenRef = useRef(false);

  const [hydratedRecord, setHydratedRecord] = useState<HydratedAttachmentRecord | null>(null);
  const [hydratingKey, setHydratingKey] = useState<string | null>(null);
  const [blobState, setBlobState] = useState<BlobUrlState | null>(null);
  const [copied, setCopied] = useState(false);
  const [csvMode, setCsvMode] = useState<'table' | 'raw'>('table');

  useEffect(() => {
    onCloseRef.current = onClose;
    onExitedRef.current = onExited;
  });

  const fileKey = file ? `${file.name}::${file.ext}` : '';
  const needsHydration = Boolean(
    file && !file.previewUrl && !file.dataUrl && typeof file.content !== 'string'
  );

  // Pull the full attachment payload (dataUrl, content, size) out of IndexedDB when opening from sent messages
  useEffect(() => {
    if (!file || !needsHydration) return;
    let cancelled = false;
    const targetKey = `${file.name}::${file.ext}`;
    const frame = window.requestAnimationFrame(() => {
      if (!cancelled) setHydratingKey(targetKey);
    });

    void getStoredFileClient(file.name).then((record) => {
      if (cancelled) return;
      setHydratingKey(null);
      setHydratedRecord({
        key: targetKey,
        dataUrl: record?.dataUrl,
        content: record?.content,
        size: record?.size,
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [file, fileKey, needsHydration]);

  const activeHydrated = hydratedRecord?.key === fileKey ? hydratedRecord : null;
  const resolvedDataUrl = file?.dataUrl || activeHydrated?.dataUrl;
  const resolvedSize = file?.size ?? activeHydrated?.size;
  const ext = (file?.ext || file?.name.split('.').pop() || 'other').replace(/^\./, '').toLowerCase();
  const isHydrating = Boolean(file && needsHydration && !activeHydrated && hydratingKey === fileKey);

  // Turn dataUrl into a real blob URL so PDF iframes, media players, and downloads don't shit the bed
  useEffect(() => {
    if (!resolvedDataUrl || file?.previewUrl) return;
    const blob = dataUrlToBlob(resolvedDataUrl);
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (!cancelled) {
        setBlobState({ source: resolvedDataUrl, url: objectUrl });
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      URL.revokeObjectURL(objectUrl);
    };
  }, [file?.previewUrl, resolvedDataUrl]);

  const activeBlobUrl =
    resolvedDataUrl && blobState?.source === resolvedDataUrl ? blobState.url : undefined;
  const resolvedBlobOrSelfUrl = file?.previewUrl || activeBlobUrl;
  const resolvedMediaUrl = resolvedBlobOrSelfUrl || resolvedDataUrl;

  const isImage = IMAGE_EXTS.has(ext);
  const isPdf = ext === 'pdf';
  const isVideo = VIDEO_EXTS.has(ext);
  const isAudio = AUDIO_EXTS.has(ext);
  const isCsv = ext === 'csv' || ext === 'tsv';
  const isCode = CODE_EXTS.has(ext);
  const isProse = PROSE_EXTS.has(ext);
  const isTextLike = isCsv || isCode || isProse;

  const resolvedText = useMemo(() => {
    if (!file) return undefined;
    if (typeof file.content === 'string') return file.content;
    if (typeof activeHydrated?.content === 'string') return activeHydrated.content;
    if (resolvedDataUrl && isTextLike) {
      return decodeTextFromDataUrl(resolvedDataUrl) ?? undefined;
    }
    return undefined;
  }, [activeHydrated?.content, file, isTextLike, resolvedDataUrl]);

  const formattedText = useMemo(() => {
    if (typeof resolvedText !== 'string') return undefined;
    if (ext === 'json' && resolvedText.length <= 400_000) {
      try {
        return JSON.stringify(JSON.parse(resolvedText), null, 2);
      } catch {
        return resolvedText;
      }
    }
    return resolvedText;
  }, [ext, resolvedText]);

  const parsedCsv = useMemo(() => {
    if (!isCsv || typeof resolvedText !== 'string') return null;
    return parseDelimitedText(resolvedText, ext === 'tsv' ? '\t' : ',');
  }, [ext, isCsv, resolvedText]);

  // Reset the copied flag after 1.8s via timeout
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  // GSAP modal open/close animation bs
  useEffect(() => {
    if (!file) {
      wasOpenRef.current = false;
      return;
    }

    const backdropEl = backdropRef.current;
    const modalEl = modalRef.current;
    if (!backdropEl || !modalEl) return;

    const reduce = prefersReducedMotion();

    if (isOpen) {
      wasOpenRef.current = true;
      gsap.killTweensOf([backdropEl, modalEl]);
      gsap.fromTo(
        backdropEl,
        { opacity: 0 },
        { opacity: 1, duration: reduce ? 0.01 : 0.22, ease: 'power2.out' }
      );
      gsap.fromTo(
        modalEl,
        { opacity: 0, y: reduce ? 0 : 18, scale: reduce ? 1 : 0.965 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: reduce ? 0.01 : 0.3,
          ease: 'expo.out',
          clearProps: 'transform',
        }
      );
      return;
    }

    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      gsap.killTweensOf([backdropEl, modalEl]);
      const tl = gsap.timeline({
        onComplete: () => {
          onExitedRef.current?.();
        },
      });
      tl.to(
        modalEl,
        {
          opacity: 0,
          y: reduce ? 0 : 10,
          scale: reduce ? 1 : 0.975,
          duration: reduce ? 0.01 : 0.17,
          ease: 'power2.in',
        },
        0
      ).to(
        backdropEl,
        { opacity: 0, duration: reduce ? 0.01 : 0.17, ease: 'power2.in' },
        0
      );
    }
  }, [file, isOpen]);

  // Close on Escape and lock body scroll so the page behind doesn't scroll like ass
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!file || typeof document === 'undefined') return null;

  const displayName = getCleanDisplayName(file.name);
  const sizeLabel = formatFileSize(resolvedSize);
  const typeLabel = getDocumentLabel(ext);
  const textLines = formattedText !== undefined ? formattedText.split(/\r?\n/) : null;
  const metaParts = [typeLabel];
  if (sizeLabel) metaParts.push(sizeLabel);
  if (parsedCsv && parsedCsv.rows.length > 0) {
    metaParts.push(`${parsedCsv.rows.length}${parsedCsv.truncated ? '+' : ''} rows`);
  } else if (textLines) {
    metaParts.push(`${textLines.length} lines`);
  }

  const canDownload = Boolean(resolvedMediaUrl || resolvedText !== undefined);

  const handleCopyText = async () => {
    if (typeof formattedText !== 'string') return;
    try {
      await navigator.clipboard.writeText(formattedText);
      setCopied(true);
    } catch {
      // Ignore clipboard permission errors in locked-down browser contexts
    }
  };

  const handleDownload = () => {
    if (resolvedMediaUrl) {
      const link = document.createElement('a');
      link.href = resolvedMediaUrl;
      link.download = displayName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }
    if (typeof resolvedText === 'string') {
      const blob = new Blob([resolvedText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = displayName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  return createPortal(
    <div
      ref={backdropRef}
      role="presentation"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
      className="dc-preview-backdrop fixed inset-0 z-[9998] flex items-center justify-center p-2.5 sm:p-6"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${displayName}`}
        onClick={(event) => event.stopPropagation()}
        className={`dc-preview-modal relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-[24px] ${
          isPdf || isCsv || isCode || isProse || formattedText !== undefined
            ? 'max-w-4xl'
            : isImage || isVideo
              ? 'max-w-4xl'
              : 'max-w-lg'
        }`}
      >
        {/* Modal header bar */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="dc-tools-icon-well h-9 w-9 rounded-xl">
              {getPreviewHeaderIcon(ext, 'h-[18px] w-[18px]')}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[14.5px] font-semibold leading-tight text-[var(--dc-text-strong)] sm:text-[15.5px]">
                {displayName}
              </h2>
              <p className="mt-0.5 truncate text-[11.5px] font-medium text-[var(--dc-text-muted)]">
                {metaParts.join(' · ')}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {isCsv && parsedCsv && parsedCsv.rows.length > 0 && (
              <div className="mr-1 hidden items-center rounded-xl border border-[var(--dc-border)] p-0.5 sm:inline-flex">
                <button
                  type="button"
                  onClick={() => setCsvMode('table')}
                  className={`rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                    csvMode === 'table'
                      ? 'bg-[var(--dc-fill-hover)] text-[var(--dc-text-strong)]'
                      : 'text-[var(--dc-text-muted)] hover:text-[var(--dc-text-strong)]'
                  }`}
                >
                  Table
                </button>
                <button
                  type="button"
                  onClick={() => setCsvMode('raw')}
                  className={`rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                    csvMode === 'raw'
                      ? 'bg-[var(--dc-fill-hover)] text-[var(--dc-text-strong)]'
                      : 'text-[var(--dc-text-muted)] hover:text-[var(--dc-text-strong)]'
                  }`}
                >
                  Raw
                </button>
              </div>
            )}

            {formattedText !== undefined && (
              <button
                type="button"
                onClick={handleCopyText}
                aria-label="Copy document content"
                className="dc-preview-action-btn inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[12px] font-semibold active:scale-95 sm:px-3"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" strokeWidth={2.4} />
                ) : (
                  <Copy className="h-3.5 w-3.5" strokeWidth={2.1} />
                )}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}

            {isPdf && resolvedBlobOrSelfUrl && (
              <a
                href={resolvedBlobOrSelfUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open PDF in new tab"
                className="dc-preview-action-btn inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[12px] font-semibold active:scale-95 sm:px-3"
              >
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.1} />
                <span className="hidden sm:inline">Open</span>
              </a>
            )}

            {canDownload && (
              <button
                type="button"
                onClick={handleDownload}
                aria-label={`Download ${displayName}`}
                className="dc-preview-action-btn inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[12px] font-semibold active:scale-95 sm:px-3"
              >
                <Download className="h-3.5 w-3.5" strokeWidth={2.2} />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="dc-preview-action-btn flex h-9 w-9 items-center justify-center rounded-xl active:scale-90"
            >
              <X className="h-4.5 w-4.5" strokeWidth={2.3} />
            </button>
          </div>
        </div>

        {/* Main preview viewport */}
        <div className="dc-preview-surface flex min-h-[220px] flex-1 flex-col overflow-hidden">
          {isHydrating ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[var(--dc-border-strong)] border-t-[var(--deepchat-accent)]" />
              <p className="text-[13px] font-medium text-[var(--dc-text-muted)]">
                Loading document preview...
              </p>
            </div>
          ) : isImage && resolvedMediaUrl ? (
            <div className="custom-scrollbar flex flex-1 items-center justify-center overflow-auto p-3 sm:p-5">
              <NextImage
                src={resolvedMediaUrl}
                alt={displayName}
                width={1400}
                height={1400}
                unoptimized
                className="max-h-[72dvh] w-auto max-w-full rounded-[14px] object-contain shadow-lg"
              />
            </div>
          ) : isPdf && resolvedBlobOrSelfUrl ? (
            <div className="flex flex-1 flex-col overflow-hidden">
              <iframe
                src={resolvedBlobOrSelfUrl}
                title={displayName}
                className="min-h-[58dvh] w-full flex-1 border-0 bg-white sm:min-h-[68dvh]"
              />
              <div className="flex items-center justify-between gap-3 border-t border-[var(--dc-border-subtle)] px-4 py-2 text-[11.5px] font-medium text-[var(--dc-text-muted)] sm:hidden">
                <span>Tap Open if inline scrolling is limited</span>
                <a
                  href={resolvedBlobOrSelfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[var(--deepchat-accent)] underline underline-offset-2"
                >
                  Open PDF
                </a>
              </div>
            </div>
          ) : isVideo && resolvedBlobOrSelfUrl ? (
            <div className="flex flex-1 items-center justify-center p-3 sm:p-5">
              <video
                controls
                playsInline
                src={resolvedBlobOrSelfUrl}
                className="max-h-[70dvh] w-full rounded-[14px] bg-black shadow-lg"
              />
            </div>
          ) : isAudio && resolvedBlobOrSelfUrl ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
              <div className="dc-tools-icon-well h-16 w-16 rounded-2xl">
                <Volume2 className="h-7 w-7" strokeWidth={1.9} />
              </div>
              <div className="max-w-xs">
                <p className="truncate text-[14.5px] font-semibold text-[var(--dc-text-strong)]">
                  {displayName}
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-[var(--dc-text-muted)]">
                  {metaParts.join(' · ')}
                </p>
              </div>
              <audio controls src={resolvedBlobOrSelfUrl} className="w-full max-w-md" />
            </div>
          ) : isCsv && parsedCsv && parsedCsv.rows.length > 0 && csvMode === 'table' ? (
            <div className="custom-scrollbar flex-1 overflow-auto">
              <table className="w-full border-collapse text-left text-[12.5px]">
                <thead className="sticky top-0 z-10 bg-[var(--dc-surface)] shadow-[0_1px_0_var(--dc-border)]">
                  <tr>
                    <th className="w-10 px-3 py-2 text-right font-mono text-[11px] font-medium text-[var(--dc-text-faint)]">
                      #
                    </th>
                    {parsedCsv.rows[0].map((header, colIdx) => (
                      <th
                        key={colIdx}
                        className="max-w-[220px] truncate whitespace-nowrap px-3 py-2 font-semibold text-[var(--dc-text-strong)]"
                      >
                        {header || `Column ${colIdx + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--dc-border-subtle)]">
                  {parsedCsv.rows.slice(1).map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className="transition-colors hover:bg-[rgb(15_23_42/0.03)] dark:hover:bg-[rgb(255_255_255/0.03)]"
                    >
                      <td className="px-3 py-1.5 text-right font-mono text-[11px] text-[var(--dc-text-faint)]">
                        {rowIdx + 1}
                      </td>
                      {parsedCsv.rows[0].map((_, colIdx) => (
                        <td
                          key={colIdx}
                          className="max-w-[260px] truncate whitespace-nowrap px-3 py-1.5 text-[var(--dc-text)]"
                        >
                          {row[colIdx] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedCsv.truncated && (
                <div className="border-t border-[var(--dc-border-subtle)] px-4 py-2 text-center text-[11.5px] font-medium text-[var(--dc-text-muted)]">
                  Showing first {MAX_CSV_ROWS} rows for fast preview
                </div>
              )}
            </div>
          ) : textLines ? (
            <div className="custom-scrollbar flex-1 overflow-auto p-3.5 sm:p-5">
              {isCode ? (
                <div className="font-mono text-[12.5px] leading-[1.6] text-[var(--dc-text-strong)]">
                  {textLines.map((line, index) => (
                    <div key={index} className="flex gap-4">
                      <span className="w-8 shrink-0 select-none text-right text-[11px] text-[var(--dc-text-faint)]">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                        {line || ' '}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-words font-sans text-[13.5px] leading-[1.68] text-[var(--dc-text-strong)] sm:text-[14px]">
                  {formattedText}
                </pre>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
              <div className="dc-tools-icon-well h-16 w-16 rounded-2xl">
                {getPreviewHeaderIcon(ext, 'h-7 w-7')}
              </div>
              <div className="max-w-sm">
                <p className="break-words text-[15px] font-semibold text-[var(--dc-text-strong)]">
                  {displayName}
                </p>
                <p className="mt-1 text-[12.5px] font-medium text-[var(--dc-text-muted)]">
                  {metaParts.join(' · ')}
                </p>
                <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--dc-text-muted)]">
                  {canDownload
                    ? 'Inline visual preview is not available for this binary document format. You can download it to view in its native app.'
                    : 'This file is attached and ready for DeepChat to read in your conversation.'}
                </p>
              </div>
              {canDownload && (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="dc-preview-action-btn inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold active:scale-95"
                >
                  <Download className="h-4 w-4" strokeWidth={2.2} />
                  <span>Download {ext.toUpperCase()}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
