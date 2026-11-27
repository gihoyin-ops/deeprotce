'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import {
  Check,
  Download,
  File,
  FileSpreadsheet,
  FileText,
  Folder,
  Image as ImageIcon,
  Loader2
} from '@/components/ui/icons';
import {
  normalizeFileKey,
  usePythonFilesRegistry
} from '@/lib/code/python-files-context';
import {
  isSafeDownloadFilename,
  resolveSafeMimeType,
  sanitizeWorkspaceFilename,
  type PythonOutputFile
} from '@/lib/code/python-runtime';

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const triggerFileDownload = (file: PythonOutputFile) => {
  const safeName = sanitizeWorkspaceFilename(file.name, 'output.dat');
  if (!isSafeDownloadFilename(safeName)) return false;
  const bin = atob(file.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: resolveSafeMimeType(safeName) });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
};

function FileTypeIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'zip' || ext === 'tar' || ext === 'gz') {
    return <Folder className="h-[18px] w-[18px] text-amber-600 dark:text-amber-400" />;
  }
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv' || ext === 'tsv') {
    return <FileSpreadsheet className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" />;
  }
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp' || ext === 'gif' || ext === 'svg') {
    return <ImageIcon className="h-[18px] w-[18px] text-sky-600 dark:text-sky-400" />;
  }
  if (ext === 'pdf' || ext === 'docx' || ext === 'doc' || ext === 'pptx' || ext === 'txt' || ext === 'md') {
    return <FileText className="h-[18px] w-[18px] text-indigo-600 dark:text-indigo-400" />;
  }
  return <File className="h-[18px] w-[18px] text-slate-600 dark:text-slate-300" />;
}

export default function PythonFileCard({
  filename,
  directFile
}: {
  filename: string;
  directFile?: PythonOutputFile;
}) {
  const { outputFiles, activeRunnersCount } = usePythonFilesRegistry();
  const key = normalizeFileKey(filename);
  const resolvedFile = directFile ?? outputFiles[key] ?? null;
  const displayName = resolvedFile?.name || sanitizeWorkspaceFilename(filename, 'file');

  const cardRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 8, scale: 0.985 },
        { opacity: 1, y: 0, scale: 1, duration: 0.34, ease: 'power3.out', clearProps: 'transform' }
      );
    }, el);
    return () => ctx.revert();
  }, []);

  const handleDownload = () => {
    if (!resolvedFile) return;
    if (btnRef.current && !prefersReducedMotion()) {
      gsap.fromTo(
        btnRef.current,
        { scale: 0.92 },
        { scale: 1, duration: 0.25, ease: 'back.out(2.2)', clearProps: 'transform' }
      );
    }
    if (triggerFileDownload(resolvedFile)) {
      setDownloaded(true);
      window.setTimeout(() => setDownloaded(false), 1800);
    }
  };

  const isPreparing = !resolvedFile && activeRunnersCount > 0;
  const canDownload = Boolean(resolvedFile && isSafeDownloadFilename(displayName));

  return (
    <div
      ref={cardRef}
      className="not-prose my-3 flex w-full max-w-[420px] items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-slate-300/90 hover:shadow dark:border-slate-800 dark:bg-[#0d1117] dark:hover:border-slate-700"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100/90 dark:bg-slate-800/80">
          <FileTypeIcon filename={displayName} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium text-slate-900 dark:text-slate-100">
            {displayName}
          </div>
          <div className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
            {resolvedFile
              ? formatBytes(resolvedFile.size)
              : isPreparing
                ? 'Generating…'
                : 'File unavailable'}
          </div>
        </div>
      </div>

      <button
        ref={btnRef}
        type="button"
        disabled={!canDownload}
        onClick={handleDownload}
        title={canDownload ? `Download ${displayName}` : 'File not ready'}
        aria-label={canDownload ? `Download ${displayName}` : 'File not ready'}
        className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs font-medium transition-colors ${
          canDownload
            ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200'
            : 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500'
        }`}
      >
        {isPreparing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : downloaded ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-400 dark:text-emerald-600" />
            <span>Saved</span>
          </>
        ) : (
          <>
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </>
        )}
      </button>
    </div>
  );
}
