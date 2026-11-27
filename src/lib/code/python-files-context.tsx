'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { PythonOutputFile, PythonWorkspaceInputFile } from '@/lib/code/python-runtime';

interface PythonFilesContextValue {
  inputFiles: PythonWorkspaceInputFile[];
  outputFiles: Record<string, PythonOutputFile>;
  referencedFiles: Set<string>;
  activeRunnersCount: number;
  registerOutputFiles: (files: PythonOutputFile[]) => void;
  setRunnerActive: (runnerId: string, active: boolean) => void;
}

const defaultValue: PythonFilesContextValue = {
  inputFiles: [],
  outputFiles: {},
  referencedFiles: new Set<string>(),
  activeRunnersCount: 0,
  registerOutputFiles: () => {},
  setRunnerActive: () => {}
};

const PythonFilesContext = createContext<PythonFilesContextValue>(defaultValue);

const normalizeFileKey = (name: string) => name.trim().split(/[\\/]/).pop()?.toLowerCase() || '';

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

export function PythonFilesProvider({
  files,
  referencedFiles,
  children
}: {
  files: PythonWorkspaceInputFile[];
  referencedFiles?: Set<string>;
  children: React.ReactNode;
}) {
  const [outputFiles, setOutputFiles] = useState<Record<string, PythonOutputFile>>({});
  const [activeRunners, setActiveRunners] = useState<Record<string, boolean>>({});

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

  const activeRunnersCount = Object.keys(activeRunners).length;
  const stableReferenced = useMemo(() => referencedFiles ?? new Set<string>(), [referencedFiles]);

  const value = useMemo<PythonFilesContextValue>(
    () => ({
      inputFiles: files,
      outputFiles,
      referencedFiles: stableReferenced,
      activeRunnersCount,
      registerOutputFiles,
      setRunnerActive
    }),
    [files, outputFiles, stableReferenced, activeRunnersCount, registerOutputFiles, setRunnerActive]
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
