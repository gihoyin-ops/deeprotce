'use client';

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { PythonOutputFile, PythonWorkspaceInputFile } from '@/lib/code/python-runtime';

export interface PythonOutputChart {
  id: string;
  runnerId: string;
  kind: 'plotly' | 'image';
  data: string;
  sourceCode: string;
}

interface PythonFilesContextValue {
  inputFiles: PythonWorkspaceInputFile[];
  outputFiles: Record<string, PythonOutputFile>;
  outputCharts: PythonOutputChart[];
  referencedFiles: Set<string>;
  referencedCharts: Set<string>;
  isMessageStreaming: boolean;
  activeRunnersCount: number;
  runnerStatus: string;
  runnerError: string;
  registerOutputFiles: (files: PythonOutputFile[]) => void;
  registerOutputCharts: (runnerId: string, charts: PythonOutputChart[]) => void;
  setRunnerActive: (runnerId: string, active: boolean) => void;
  setRunnerStatus: (runnerId: string, status: string) => void;
  setRunnerError: (runnerId: string, error: string) => void;
  registerRunnerUpdater: (runnerId: string, updater: (nextCode: string) => void) => () => void;
  updateRunnerCode: (runnerId: string, nextCode: string) => boolean;
}

const defaultValue: PythonFilesContextValue = {
  inputFiles: [],
  outputFiles: {},
  outputCharts: [],
  referencedFiles: new Set<string>(),
  referencedCharts: new Set<string>(),
  isMessageStreaming: false,
  activeRunnersCount: 0,
  runnerStatus: '',
  runnerError: '',
  registerOutputFiles: () => {},
  registerOutputCharts: () => {},
  setRunnerActive: () => {},
  setRunnerStatus: () => {},
  setRunnerError: () => {},
  registerRunnerUpdater: () => () => {},
  updateRunnerCode: () => false
};

const PythonFilesContext = createContext<PythonFilesContextValue>(defaultValue);

const normalizeFileKey = (name: string) => name.trim().split(/[\\/]/).pop()?.toLowerCase() || '';

export const normalizeChartKey = (raw = ''): string => {
  const cleaned = raw.trim().toLowerCase();
  return cleaned || 'default';
};

export const extractReferencedPythonFiles = (markdown: string): Set<string> => {
  const refs = new Set<string>();
  if (!markdown) return refs;
  const segments = markdown.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  const bracketPattern = /\[\[file:([^\[\]\n\r]+?)\]\]/gi;
  const linkPattern = /deepchat-file:\/\/([^\s)]+)/gi;

  for (let i = 0; i < segments.length; i += 1) {
    if (i % 2 === 1) continue;
    for (const match of segments[i].matchAll(bracketPattern)) {
      const key = normalizeFileKey(match[1]);
      if (key) refs.add(key);
    }
    for (const match of segments[i].matchAll(linkPattern)) {
      const key = normalizeFileKey(decodeURIComponent(match[1]));
      if (key) refs.add(key);
    }
  }
  return refs;
};

export const extractReferencedPythonCharts = (markdown: string): string[] => {
  const refs: string[] = [];
  if (!markdown) return refs;
  const segments = markdown.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  const bracketPattern = /\[\[chart(?::([^\[\]\n\r]+?))?\]\]/gi;
  const linkPattern = /deepchat-chart:\/\/([^\s)]+)/gi;

  for (let i = 0; i < segments.length; i += 1) {
    if (i % 2 === 1) continue;
    for (const match of segments[i].matchAll(bracketPattern)) {
      refs.push(normalizeChartKey(match[1] ?? 'default'));
    }
    for (const match of segments[i].matchAll(linkPattern)) {
      refs.push(normalizeChartKey(decodeURIComponent(match[1] ?? 'default')));
    }
  }
  return refs;
};

export function PythonFilesProvider({
  files,
  referencedFiles,
  referencedCharts,
  isMessageStreaming = false,
  children
}: {
  files: PythonWorkspaceInputFile[];
  referencedFiles?: Set<string>;
  referencedCharts?: Set<string>;
  isMessageStreaming?: boolean;
  children: React.ReactNode;
}) {
  const [outputFiles, setOutputFiles] = useState<Record<string, PythonOutputFile>>({});
  const [outputCharts, setOutputCharts] = useState<PythonOutputChart[]>([]);
  const [activeRunners, setActiveRunners] = useState<Record<string, boolean>>({});
  const [statusByRunner, setStatusByRunner] = useState<Record<string, string>>({});
  const [errorByRunner, setErrorByRunner] = useState<Record<string, string>>({});
  const updatersRef = useRef<Record<string, (nextCode: string) => void>>({});

  const registerOutputFiles = useCallback((nextFiles: PythonOutputFile[]) => {
    if (!Array.isArray(nextFiles) || nextFiles.length === 0) return;
    setOutputFiles((prev) => {
      const updated = { ...prev };
      for (const file of nextFiles) {
        const key = normalizeFileKey(file.name);
        if (key) updated[key] = file;
      }
      return updated;
    });
  }, []);

  const registerOutputCharts = useCallback((runnerId: string, charts: PythonOutputChart[]) => {
    setOutputCharts((prev) => {
      const withoutRunner = prev.filter((item) => item.runnerId !== runnerId);
      return [...withoutRunner, ...charts];
    });
  }, []);

  const setRunnerActive = useCallback((runnerId: string, active: boolean) => {
    setActiveRunners((prev) => {
      const currentlyActive = Boolean(prev[runnerId]);
      if (currentlyActive === active) return prev;
      const next = { ...prev };
      if (active) next[runnerId] = true;
      else delete next[runnerId];
      return next;
    });
  }, []);

  const setRunnerStatus = useCallback((runnerId: string, status: string) => {
    setStatusByRunner((prev) => {
      if (!status) {
        if (!(runnerId in prev)) return prev;
        const next = { ...prev };
        delete next[runnerId];
        return next;
      }
      if (prev[runnerId] === status) return prev;
      return { ...prev, [runnerId]: status };
    });
  }, []);

  const setRunnerError = useCallback((runnerId: string, error: string) => {
    setErrorByRunner((prev) => {
      if (!error) {
        if (!(runnerId in prev)) return prev;
        const next = { ...prev };
        delete next[runnerId];
        return next;
      }
      if (prev[runnerId] === error) return prev;
      return { ...prev, [runnerId]: error };
    });
  }, []);

  const registerRunnerUpdater = useCallback((runnerId: string, updater: (nextCode: string) => void) => {
    updatersRef.current[runnerId] = updater;
    return () => {
      if (updatersRef.current[runnerId] === updater) {
        delete updatersRef.current[runnerId];
      }
    };
  }, []);

  const updateRunnerCode = useCallback((runnerId: string, nextCode: string) => {
    const updater = updatersRef.current[runnerId];
    if (!updater) return false;
    updater(nextCode);
    return true;
  }, []);

  const activeRunnersCount = Object.keys(activeRunners).length;
  const runnerStatus = useMemo(() => {
    const activeIds = Object.keys(activeRunners);
    for (let i = activeIds.length - 1; i >= 0; i -= 1) {
      const s = statusByRunner[activeIds[i]];
      if (s) return s;
    }
    const allStatuses = Object.values(statusByRunner);
    return allStatuses[allStatuses.length - 1] || '';
  }, [activeRunners, statusByRunner]);

  const runnerError = useMemo(() => {
    const errors = Object.values(errorByRunner);
    return errors[errors.length - 1] || '';
  }, [errorByRunner]);

  const stableReferencedFiles = useMemo(() => referencedFiles ?? new Set<string>(), [referencedFiles]);
  const stableReferencedCharts = useMemo(() => referencedCharts ?? new Set<string>(), [referencedCharts]);

  const value = useMemo<PythonFilesContextValue>(
    () => ({
      inputFiles: files,
      outputFiles,
      outputCharts,
      referencedFiles: stableReferencedFiles,
      referencedCharts: stableReferencedCharts,
      isMessageStreaming,
      activeRunnersCount,
      runnerStatus,
      runnerError,
      registerOutputFiles,
      registerOutputCharts,
      setRunnerActive,
      setRunnerStatus,
      setRunnerError,
      registerRunnerUpdater,
      updateRunnerCode
    }),
    [
      files,
      outputFiles,
      outputCharts,
      stableReferencedFiles,
      stableReferencedCharts,
      isMessageStreaming,
      activeRunnersCount,
      runnerStatus,
      runnerError,
      registerOutputFiles,
      registerOutputCharts,
      setRunnerActive,
      setRunnerStatus,
      setRunnerError,
      registerRunnerUpdater,
      updateRunnerCode
    ]
  );

  return (
    <PythonFilesContext.Provider value={value}>
      {children}
    </PythonFilesContext.Provider>
  );
}

export function usePythonWorkspaceFiles(): PythonWorkspaceInputFile[] {
  return useContext(PythonFilesContext).inputFiles;
}

export function usePythonFilesRegistry() {
  return useContext(PythonFilesContext);
}

export { normalizeFileKey };
