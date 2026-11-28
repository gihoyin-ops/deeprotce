'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { countDiffStats, resolveHunkDecision } from '@/lib/canvas/diff';
import {
  importDocxBuffer,
  importPptxBuffer,
  importXlsxBuffer,
  parseCsvToRows,
} from '@/lib/canvas/exporters';
import {
  loadWorkspace,
  saveWorkspace,
  uploadWorkspaceBinaryClient,
} from '@/lib/canvas/storage';
import {
  createStarterContent,
  getFileExtension,
  getMimeTypeForCanvasFile,
  inferCanvasKind,
  inferCodeLanguage,
  normalizeCanvasPath,
  type CanvasFile,
  type CanvasFileKind,
  type CanvasMode,
  type CanvasPendingDiff,
  type CanvasStreamingUpdate,
} from '@/lib/canvas/types';
import {
  registerWorkspaceSnapshot,
  subscribeCanvasEvents,
} from '@/lib/canvas/workspace-store';

interface FileHistory {
  past: string[];
  future: string[];
}

interface OpenCodeSnippetDetail {
  language: string;
  code: string;
  fileName?: string;
}

interface CanvasWorkspaceContextValue {
  chatId: string;
  isOpen: boolean;
  isHydrated: boolean;
  isSaving: boolean;
  isAgentStreaming: boolean;
  title: string;
  files: CanvasFile[];
  activeFilePath: string | null;
  activeFile: CanvasFile | null;
  activePendingDiff: CanvasPendingDiff | null;
  activeStreaming: CanvasStreamingUpdate | null;
  pendingDiffs: Record<string, CanvasPendingDiff>;
  pendingDiffCount: number;
  mode: CanvasMode;
  canUndo: boolean;
  canRedo: boolean;
  setOpen: (open: boolean) => void;
  setTitle: (title: string) => void;
  setMode: (mode: CanvasMode) => void;
  selectFile: (path: string, preferredMode?: CanvasMode) => void;
  createFile: (kind: CanvasFileKind, customPath?: string, customContent?: string) => CanvasFile | null;
  updateFileContent: (path: string, content: string, recordHistory?: boolean) => void;
  renameFile: (oldPath: string, newPath: string) => boolean;
  deleteFile: (path: string) => void;
  importDeviceFiles: (fileList: File[]) => Promise<void>;
  openCodeSnippetInCanvas: (snippet: OpenCodeSnippetDetail) => void;
  undo: () => void;
  redo: () => void;
  acceptDiff: (path: string) => void;
  rejectDiff: (path: string) => void;
  acceptHunk: (path: string, hunkId: string) => void;
  rejectHunk: (path: string, hunkId: string) => void;
  acceptAllDiffs: () => void;
  rejectAllDiffs: () => void;
}

const CanvasWorkspaceContext = createContext<CanvasWorkspaceContextValue | null>(null);

const MAX_HISTORY_PER_FILE = 40;

function makeUniquePath(basePath: string, existingFiles: CanvasFile[]): string {
  const normalized = normalizeCanvasPath(basePath) || 'untitled.txt';
  const existing = new Set(existingFiles.map((f) => f.path.toLowerCase()));
  if (!existing.has(normalized.toLowerCase())) return normalized;

  const dotIdx = normalized.lastIndexOf('.');
  const stem = dotIdx > 0 ? normalized.slice(0, dotIdx) : normalized;
  const ext = dotIdx > 0 ? normalized.slice(dotIdx) : '';
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${stem}-${i}${ext}`;
    if (!existing.has(candidate.toLowerCase())) return candidate;
  }
  return `${stem}-${Date.now()}${ext}`;
}

function getDefaultPathForKind(kind: CanvasFileKind, existingFiles: CanvasFile[]): string {
  const baseMap: Record<CanvasFileKind, string> = {
    code: 'index.html',
    doc: 'document.docx',
    sheet: 'sheet.xlsx',
    slides: 'presentation.pptx',
    pdf: 'report.pdf',
  };
  return makeUniquePath(baseMap[kind], existingFiles);
}

function snippetExtension(language: string, fileName?: string): string {
  if (fileName) {
    const clean = normalizeCanvasPath(fileName);
    if (clean) return clean;
  }
  const lower = language.trim().toLowerCase();
  if (lower === 'html') return 'index.html';
  if (lower === 'css') return 'style.css';
  if (lower === 'javascript' || lower === 'js') return 'app.js';
  if (lower === 'json') return 'data.json';
  if (lower === 'svg') return 'graphic.svg';
  if (lower === 'markdown' || lower === 'md') return 'document.md';
  return `snippet.${lower || 'txt'}`;
}

export function CanvasWorkspaceProvider({
  chatId,
  onOpening,
  children,
}: {
  chatId: string;
  onOpening?: () => void;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpenState] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('Workspace');
  const [files, setFiles] = useState<CanvasFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [mode, setMode] = useState<CanvasMode>('preview');
  const [pendingDiffs, setPendingDiffs] = useState<Record<string, CanvasPendingDiff>>({});
  const [streamingByPath, setStreamingByPath] = useState<Record<string, CanvasStreamingUpdate>>({});
  const [historyByPath, setHistoryByPath] = useState<Record<string, FileHistory>>({});

  const onOpeningRef = useRef(onOpening);
  useEffect(() => {
    onOpeningRef.current = onOpening;
  });

  const saveTimerRef = useRef<number | null>(null);
  const loadedChatIdRef = useRef<string | null>(null);
  const filesRef = useRef<CanvasFile[]>([]);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const setOpen = useCallback((nextOpen: boolean) => {
    if (nextOpen) onOpeningRef.current?.();
    setIsOpenState(nextOpen);
  }, []);

  // Load persisted workspace on chatId switch
  useEffect(() => {
    let active = true;
    loadedChatIdRef.current = null;

    loadWorkspace(chatId)
      .then((ws) => {
        if (!active) return;
        const loadedFiles = ws.files || [];
        filesRef.current = loadedFiles;
        setTitle(ws.title || 'Workspace');
        setFiles(loadedFiles);
        setActiveFilePath(ws.activeFilePath || loadedFiles[0]?.path || null);
        setPendingDiffs({});
        setStreamingByPath({});
        setHistoryByPath({});
        loadedChatIdRef.current = chatId;
        setIsHydrated(true);
      })
      .catch(() => {
        if (!active) return;
        loadedChatIdRef.current = chatId;
        setIsHydrated(true);
      });

    return () => {
      active = false;
    };
  }, [chatId]);

  // Keep snapshot registry synced so /api/chat always gets up-to-date workspace context
  useEffect(() => {
    registerWorkspaceSnapshot(chatId, {
      chatId,
      title,
      activeFilePath,
      files: files.map((f) => ({
        path: f.path,
        kind: f.kind,
        content: f.content,
      })),
    });
  }, [activeFilePath, chatId, files, title]);

  // Debounced auto-save to IndexedDB + Turso (do not persist half-streamed frames)
  const isAgentStreaming = Object.keys(streamingByPath).length > 0;
  useEffect(() => {
    if (!isHydrated || loadedChatIdRef.current !== chatId || isAgentStreaming) return;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      setIsSaving(true);
      void saveWorkspace({
        chatId,
        title,
        activeFilePath,
        files,
        updatedAt: new Date().toISOString(),
      }).finally(() => setIsSaving(false));
    }, 550);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [activeFilePath, chatId, files, isAgentStreaming, isHydrated, title]);

  // Subscribe to live Canvas tool stream + ops from chat-generation
  useEffect(() => {
    return subscribeCanvasEvents(chatId, (event) => {
      if (event.type === 'focus_file') {
        setOpen(true);
        setActiveFilePath(event.path);
        return;
      }

      if (event.type === 'stream_end') {
        setStreamingByPath({});
        return;
      }

      if (event.type === 'stream_delta') {
        const { delta } = event;
        setOpen(true);
        setActiveFilePath(delta.path);
        setStreamingByPath((prev) => ({ ...prev, [delta.path]: delta }));

        if (delta.action === 'write') {
          const nowIso = new Date().toISOString();
          setFiles((prev) => {
            const idx = prev.findIndex((f) => f.path === delta.path);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                kind: delta.kind,
                language: delta.kind === 'code' ? inferCodeLanguage(delta.path) : undefined,
                content: delta.partialContent,
                sizeBytes: delta.partialContent.length,
                updatedAt: nowIso,
              };
              return updated;
            }
            return [
              ...prev,
              {
                id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                path: delta.path,
                kind: delta.kind,
                language: delta.kind === 'code' ? inferCodeLanguage(delta.path) : undefined,
                mimeType: getMimeTypeForCanvasFile(delta.path, delta.kind),
                content: delta.partialContent,
                sizeBytes: delta.partialContent.length,
                updatedAt: nowIso,
              },
            ];
          });
          setMode((current) => {
            if (delta.kind === 'code') return current === 'preview' ? 'preview' : 'edit';
            return 'preview';
          });
        }
        return;
      }

      if (event.type === 'op') {
        const { op } = event;
        const nowIso = new Date().toISOString();

        setOpen(true);
        setActiveFilePath(op.path);
        setStreamingByPath((prev) => {
          if (!(op.path in prev)) return prev;
          const next = { ...prev };
          delete next[op.path];
          return next;
        });

        const currentFiles = filesRef.current;
        const existing = currentFiles.find((f) => f.path === op.path);

        if (op.action === 'delete') {
          if (!existing) return;
          setPendingDiffs((prevDiffs) => ({
            ...prevDiffs,
            [op.path]: {
              path: op.path,
              kind: op.kind,
              baseContent: existing.content,
              proposedContent: '',
              summary: op.summary,
              action: 'delete',
              updatedAt: nowIso,
            },
          }));
          setMode('diff');
          return;
        }

        const baseContent = existing ? existing.content : op.previousContent ?? '';
        const nextFile: CanvasFile = existing
          ? {
              ...existing,
              kind: op.kind,
              language: op.kind === 'code' ? inferCodeLanguage(op.path) : undefined,
              mimeType: getMimeTypeForCanvasFile(op.path, op.kind),
              content: op.content,
              sizeBytes: op.content.length,
              updatedAt: nowIso,
            }
          : {
              id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              path: op.path,
              kind: op.kind,
              language: op.kind === 'code' ? inferCodeLanguage(op.path) : undefined,
              mimeType: getMimeTypeForCanvasFile(op.path, op.kind),
              content: op.content,
              sizeBytes: op.content.length,
              updatedAt: nowIso,
            };

        const updatedFiles = existing
          ? currentFiles.map((f) => (f.path === op.path ? nextFile : f))
          : [...currentFiles, nextFile];
        filesRef.current = updatedFiles;
        setFiles(updatedFiles);

        setPendingDiffs((prevDiffs) => {
          const existingPending = prevDiffs[op.path];
          return {
            ...prevDiffs,
            [op.path]: {
              path: op.path,
              kind: op.kind,
              baseContent: existingPending ? existingPending.baseContent : baseContent,
              proposedContent: op.content,
              summary: op.summary,
              action: op.action,
              updatedAt: nowIso,
            },
          };
        });

        if (op.kind === 'code' && op.action === 'update') {
          setMode('diff');
        } else {
          setMode('preview');
        }
      }
    });
  }, [chatId, setOpen]);

  const activeFile = useMemo(
    () => files.find((f) => f.path === activeFilePath) || files[0] || null,
    [activeFilePath, files]
  );

  const resolvedActivePath = activeFile?.path ?? null;
  const activePendingDiff = resolvedActivePath ? pendingDiffs[resolvedActivePath] ?? null : null;
  const activeStreaming = resolvedActivePath ? streamingByPath[resolvedActivePath] ?? null : null;

  const activeHistory = resolvedActivePath ? historyByPath[resolvedActivePath] : undefined;
  const canUndo = Boolean(activeHistory && activeHistory.past.length > 0);
  const canRedo = Boolean(activeHistory && activeHistory.future.length > 0);

  const selectFile = useCallback(
    (path: string, preferredMode?: CanvasMode) => {
      setActiveFilePath(path);
      if (preferredMode) {
        setMode(preferredMode);
        return;
      }
      if (mode === 'diff' && !pendingDiffs[path]) {
        setMode('preview');
      }
    },
    [mode, pendingDiffs]
  );

  const createFile = useCallback(
    (kind: CanvasFileKind, customPath?: string, customContent?: string): CanvasFile | null => {
      const targetPath = customPath
        ? makeUniquePath(customPath, files)
        : getDefaultPathForKind(kind, files);
      const content =
        typeof customContent === 'string'
          ? customContent
          : createStarterContent(kind, targetPath);
      const nowIso = new Date().toISOString();
      const created: CanvasFile = {
        id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        path: targetPath,
        kind,
        language: kind === 'code' ? inferCodeLanguage(targetPath) : undefined,
        mimeType: getMimeTypeForCanvasFile(targetPath, kind),
        content,
        sizeBytes: content.length,
        updatedAt: nowIso,
      };
      setFiles((prev) => [...prev, created]);
      setActiveFilePath(created.path);
      setMode(kind === 'code' ? 'edit' : 'preview');
      setOpen(true);
      return created;
    },
    [files, setOpen]
  );

  const updateFileContent = useCallback(
    (path: string, nextContent: string, recordHistory = true) => {
      const target = filesRef.current.find((f) => f.path === path);
      if (!target || target.content === nextContent) return;

      const previousContent = target.content;
      const nowIso = new Date().toISOString();
      const updatedFiles = filesRef.current.map((f) =>
        f.path === path
          ? {
              ...f,
              content: nextContent,
              sizeBytes: nextContent.length,
              updatedAt: nowIso,
            }
          : f
      );
      filesRef.current = updatedFiles;
      setFiles(updatedFiles);

      if (recordHistory) {
        setHistoryByPath((hPrev) => {
          const cur = hPrev[path] || { past: [], future: [] };
          const lastPast = cur.past[cur.past.length - 1];
          if (lastPast === previousContent) return hPrev;
          return {
            ...hPrev,
            [path]: {
              past: [...cur.past.slice(-(MAX_HISTORY_PER_FILE - 1)), previousContent],
              future: [],
            },
          };
        });
      }
    },
    []
  );

  const renameFile = useCallback(
    (oldPath: string, rawNewPath: string): boolean => {
      const cleanNew = normalizeCanvasPath(rawNewPath);
      if (!cleanNew || cleanNew === oldPath) return false;
      if (files.some((f) => f.path.toLowerCase() === cleanNew.toLowerCase())) return false;

      const nextKind = inferCanvasKind(cleanNew);
      setFiles((prev) =>
        prev.map((f) =>
          f.path === oldPath
            ? {
                ...f,
                path: cleanNew,
                kind: nextKind,
                language: nextKind === 'code' ? inferCodeLanguage(cleanNew) : undefined,
                mimeType: getMimeTypeForCanvasFile(cleanNew, nextKind),
                updatedAt: new Date().toISOString(),
              }
            : f
        )
      );
      setActiveFilePath((cur) => (cur === oldPath ? cleanNew : cur));
      setPendingDiffs((prev) => {
        if (!prev[oldPath]) return prev;
        const next = { ...prev };
        next[cleanNew] = { ...prev[oldPath], path: cleanNew, kind: nextKind };
        delete next[oldPath];
        return next;
      });
      setHistoryByPath((prev) => {
        if (!prev[oldPath]) return prev;
        const next = { ...prev };
        next[cleanNew] = prev[oldPath];
        delete next[oldPath];
        return next;
      });
      return true;
    },
    [files]
  );

  const deleteFile = useCallback((path: string) => {
    const remaining = filesRef.current.filter((f) => f.path !== path);
    filesRef.current = remaining;
    setFiles(remaining);
    setActiveFilePath((cur) => (cur === path ? remaining[0]?.path ?? null : cur));
    setPendingDiffs((prev) => {
      if (!prev[path]) return prev;
      const next = { ...prev };
      delete next[path];
      return next;
    });
  }, []);

  const importDeviceFiles = useCallback(
    async (fileList: File[]) => {
      const createdPaths: string[] = [];
      for (const file of fileList) {
        const cleanName = makeUniquePath(file.name, files);
        const ext = getFileExtension(cleanName);
        const nowIso = new Date().toISOString();

        if (ext === 'pdf') {
          const uploaded = await uploadWorkspaceBinaryClient(chatId, file);
          const created: CanvasFile = {
            id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            path: cleanName,
            kind: 'pdf',
            mimeType: 'application/pdf',
            content: '',
            r2Key: uploaded.r2Key,
            publicUrl: uploaded.publicUrl,
            binaryDataUrl: uploaded.binaryDataUrl,
            sizeBytes: uploaded.sizeBytes,
            updatedAt: nowIso,
          };
          setFiles((prev) => [...prev, created]);
          createdPaths.push(created.path);
          continue;
        }

        if (ext === 'xlsx' || ext === 'xls') {
          const wb = await importXlsxBuffer(await file.arrayBuffer());
          const content = JSON.stringify(wb, null, 2);
          createFile('sheet', cleanName, content);
          createdPaths.push(cleanName);
          continue;
        }

        if (ext === 'csv' || ext === 'tsv') {
          const raw = await file.text();
          const rows = parseCsvToRows(raw);
          const content = JSON.stringify({ sheets: [{ name: 'Sheet1', rows }] }, null, 2);
          createFile('sheet', cleanName, content);
          createdPaths.push(cleanName);
          continue;
        }

        if (ext === 'docx') {
          const md = await importDocxBuffer(await file.arrayBuffer());
          createFile('doc', cleanName, md);
          createdPaths.push(cleanName);
          continue;
        }

        if (ext === 'pptx') {
          const deck = await importPptxBuffer(await file.arrayBuffer());
          createFile('slides', cleanName, JSON.stringify(deck, null, 2));
          createdPaths.push(cleanName);
          continue;
        }

        const text = await file.text();
        const kind = inferCanvasKind(cleanName);
        createFile(kind, cleanName, text);
        createdPaths.push(cleanName);
      }

      if (createdPaths.length > 0) {
        setActiveFilePath(createdPaths[createdPaths.length - 1]);
        setMode('preview');
        setOpen(true);
      }
    },
    [chatId, createFile, files, setOpen]
  );

  const openCodeSnippetInCanvas = useCallback(
    (snippet: OpenCodeSnippetDetail) => {
      const targetName = snippetExtension(snippet.language, snippet.fileName);
      const kind = inferCanvasKind(targetName);
      const existing = files.find((f) => f.path.toLowerCase() === targetName.toLowerCase());
      if (existing && existing.content === snippet.code) {
        setActiveFilePath(existing.path);
        setMode('preview');
        setOpen(true);
        return;
      }
      const created = createFile(kind, targetName, snippet.code);
      if (created) {
        setMode('preview');
      }
    },
    [createFile, files, setOpen]
  );

  // Listen to "Open in Canvas" bridge events fired from CodePreview blocks
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<OpenCodeSnippetDetail>).detail;
      if (!detail || typeof detail.code !== 'string') return;
      openCodeSnippetInCanvas(detail);
    };
    window.addEventListener('deepchat:open-in-canvas', handler);
    return () => window.removeEventListener('deepchat:open-in-canvas', handler);
  }, [openCodeSnippetInCanvas]);

  const undo = useCallback(() => {
    if (!resolvedActivePath || !activeFile) return;
    const hist = historyByPath[resolvedActivePath];
    if (!hist || hist.past.length === 0) return;

    const previous = hist.past[hist.past.length - 1];
    const nextPast = hist.past.slice(0, -1);
    const nextFuture = [activeFile.content, ...hist.future].slice(0, MAX_HISTORY_PER_FILE);

    setHistoryByPath((prev) => ({
      ...prev,
      [resolvedActivePath]: { past: nextPast, future: nextFuture },
    }));
    setFiles((prev) =>
      prev.map((f) =>
        f.path === resolvedActivePath
          ? { ...f, content: previous, sizeBytes: previous.length, updatedAt: new Date().toISOString() }
          : f
      )
    );
  }, [activeFile, historyByPath, resolvedActivePath]);

  const redo = useCallback(() => {
    if (!resolvedActivePath || !activeFile) return;
    const hist = historyByPath[resolvedActivePath];
    if (!hist || hist.future.length === 0) return;

    const next = hist.future[0];
    const nextFuture = hist.future.slice(1);
    const nextPast = [...hist.past, activeFile.content].slice(-MAX_HISTORY_PER_FILE);

    setHistoryByPath((prev) => ({
      ...prev,
      [resolvedActivePath]: { past: nextPast, future: nextFuture },
    }));
    setFiles((prev) =>
      prev.map((f) =>
        f.path === resolvedActivePath
          ? { ...f, content: next, sizeBytes: next.length, updatedAt: new Date().toISOString() }
          : f
      )
    );
  }, [activeFile, historyByPath, resolvedActivePath]);

  const acceptDiff = useCallback(
    (path: string) => {
      const diff = pendingDiffs[path];
      if (!diff) return;

      if (diff.action === 'delete') {
        deleteFile(path);
        setMode('preview');
        return;
      }

      const nowIso = new Date().toISOString();
      setFiles((prev) =>
        prev.map((f) =>
          f.path === path
            ? { ...f, content: diff.proposedContent, sizeBytes: diff.proposedContent.length, updatedAt: nowIso }
            : f
        )
      );
      if (diff.baseContent) {
        setHistoryByPath((prev) => {
          const cur = prev[path] || { past: [], future: [] };
          return {
            ...prev,
            [path]: {
              past: [...cur.past.slice(-(MAX_HISTORY_PER_FILE - 1)), diff.baseContent],
              future: [],
            },
          };
        });
      }
      setPendingDiffs((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      setMode((cur) => (cur === 'diff' ? 'preview' : cur));
    },
    [deleteFile, pendingDiffs]
  );

  const rejectDiff = useCallback(
    (path: string) => {
      const diff = pendingDiffs[path];
      if (!diff) return;

      if (diff.action === 'create') {
        deleteFile(path);
        setMode('preview');
        return;
      }

      const nowIso = new Date().toISOString();
      setFiles((prev) =>
        prev.map((f) =>
          f.path === path
            ? { ...f, content: diff.baseContent, sizeBytes: diff.baseContent.length, updatedAt: nowIso }
            : f
        )
      );
      setPendingDiffs((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      setMode((cur) => (cur === 'diff' ? 'preview' : cur));
    },
    [deleteFile, pendingDiffs]
  );

  const settleHunk = useCallback(
    (path: string, hunkId: string, decision: 'accept' | 'reject') => {
      const diff = pendingDiffs[path];
      if (!diff) return;
      const result = resolveHunkDecision(diff.baseContent, diff.proposedContent, hunkId, decision);

      if (result.remainingHunks.length === 0) {
        const nowIso = new Date().toISOString();
        setFiles((prev) =>
          prev.map((f) =>
            f.path === path
              ? { ...f, content: result.nextBase, sizeBytes: result.nextBase.length, updatedAt: nowIso }
              : f
          )
        );
        setPendingDiffs((prev) => {
          const next = { ...prev };
          delete next[path];
          return next;
        });
        setMode((cur) => (cur === 'diff' ? 'preview' : cur));
        return;
      }

      const stats = countDiffStats(result.nextBase, result.nextProposed);
      setFiles((prev) =>
        prev.map((f) =>
          f.path === path
            ? {
                ...f,
                content: result.nextProposed,
                sizeBytes: result.nextProposed.length,
                updatedAt: new Date().toISOString(),
              }
            : f
        )
      );
      setPendingDiffs((prev) => ({
        ...prev,
        [path]: {
          ...diff,
          baseContent: result.nextBase,
          proposedContent: result.nextProposed,
          summary: `${diff.summary} (${stats.added} added, ${stats.removed} removed left)`,
          updatedAt: new Date().toISOString(),
        },
      }));
    },
    [pendingDiffs]
  );

  const acceptHunk = useCallback(
    (path: string, hunkId: string) => settleHunk(path, hunkId, 'accept'),
    [settleHunk]
  );

  const rejectHunk = useCallback(
    (path: string, hunkId: string) => settleHunk(path, hunkId, 'reject'),
    [settleHunk]
  );

  const acceptAllDiffs = useCallback(() => {
    const diffs = Object.values(pendingDiffs);
    if (diffs.length === 0) return;
    const toDelete = new Set(diffs.filter((d) => d.action === 'delete').map((d) => d.path));
    const remaining = filesRef.current
      .filter((f) => !toDelete.has(f.path))
      .map((f) => {
        const diff = pendingDiffs[f.path];
        return diff
          ? { ...f, content: diff.proposedContent, sizeBytes: diff.proposedContent.length, updatedAt: new Date().toISOString() }
          : f;
      });
    filesRef.current = remaining;
    setFiles(remaining);
    setActiveFilePath((cur) => (cur && toDelete.has(cur) ? remaining[0]?.path ?? null : cur));
    setPendingDiffs({});
    setMode((cur) => (cur === 'diff' ? 'preview' : cur));
  }, [pendingDiffs]);

  const rejectAllDiffs = useCallback(() => {
    const diffs = Object.values(pendingDiffs);
    if (diffs.length === 0) return;
    const toRemove = new Set(diffs.filter((d) => d.action === 'create').map((d) => d.path));
    const remaining = filesRef.current
      .filter((f) => !toRemove.has(f.path))
      .map((f) => {
        const diff = pendingDiffs[f.path];
        return diff
          ? { ...f, content: diff.baseContent, sizeBytes: diff.baseContent.length, updatedAt: new Date().toISOString() }
          : f;
      });
    filesRef.current = remaining;
    setFiles(remaining);
    setActiveFilePath((cur) => (cur && toRemove.has(cur) ? remaining[0]?.path ?? null : cur));
    setPendingDiffs({});
    setMode((cur) => (cur === 'diff' ? 'preview' : cur));
  }, [pendingDiffs]);

  const pendingDiffCount = Object.keys(pendingDiffs).length;

  const value = useMemo<CanvasWorkspaceContextValue>(
    () => ({
      chatId,
      isOpen,
      isHydrated,
      isSaving,
      isAgentStreaming,
      title,
      files,
      activeFilePath: resolvedActivePath,
      activeFile,
      activePendingDiff,
      activeStreaming,
      pendingDiffs,
      pendingDiffCount,
      mode,
      canUndo,
      canRedo,
      setOpen,
      setTitle,
      setMode,
      selectFile,
      createFile,
      updateFileContent,
      renameFile,
      deleteFile,
      importDeviceFiles,
      openCodeSnippetInCanvas,
      undo,
      redo,
      acceptDiff,
      rejectDiff,
      acceptHunk,
      rejectHunk,
      acceptAllDiffs,
      rejectAllDiffs,
    }),
    [
      acceptAllDiffs,
      acceptDiff,
      acceptHunk,
      activeFile,
      activePendingDiff,
      activeStreaming,
      canRedo,
      canUndo,
      chatId,
      createFile,
      deleteFile,
      files,
      importDeviceFiles,
      isAgentStreaming,
      isHydrated,
      isOpen,
      isSaving,
      mode,
      openCodeSnippetInCanvas,
      pendingDiffCount,
      pendingDiffs,
      redo,
      rejectAllDiffs,
      rejectDiff,
      rejectHunk,
      renameFile,
      resolvedActivePath,
      selectFile,
      setOpen,
      title,
      undo,
      updateFileContent,
    ]
  );

  return (
    <CanvasWorkspaceContext.Provider value={value}>
      {children}
    </CanvasWorkspaceContext.Provider>
  );
}

export function useCanvasWorkspace(): CanvasWorkspaceContextValue {
  const ctx = useContext(CanvasWorkspaceContext);
  if (!ctx) {
    throw new Error('useCanvasWorkspace must be used inside CanvasWorkspaceProvider');
  }
  return ctx;
}
