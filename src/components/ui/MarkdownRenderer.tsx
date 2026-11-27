'use client';

import React, { useContext, useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import Image from 'next/image';
import { gsap } from 'gsap';
import { prefersReducedMotion } from '@/components/mobile/gesture-utils';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { createHighlighter, createJavaScriptRegexEngine, type Highlighter } from 'shiki';
import 'katex/dist/katex.min.css';
import { ClientOnly } from '@/lib/utils';
import CodePreview from '@/components/ui/CodePreview';
import PythonPreview from '@/components/ui/PythonPreview';
import PythonFileCard from '@/components/ui/PythonFileCard';
import MermaidDiagramBlock from '@/components/ui/MermaidDiagramBlock';
import { extractWebPreviewSource } from '@/lib/code/code-web-preview';
import { isPythonLanguage, sanitizeWorkspaceFilename } from '@/lib/code/python-runtime';
import {
  extractReferencedPythonFiles,
  PythonFilesProvider,
  usePythonWorkspaceFiles
} from '@/lib/code/python-files-context';
import { CitationPill } from '@/components/chat/search/CitationPill';
import {
  getSourceByUrl,
  getSourceReferences,
  getSourceSiteName,
  type SearchSource
} from '@/lib/search/source-display';

let highlighterPromise: Promise<Highlighter> | null = null;

const PRELOADED_LANGS = [
  'javascript', 'typescript', 'jsx', 'tsx',
  'html', 'css', 'scss', 'xml',
  'json', 'yaml', 'toml', 'markdown',
  'python', 'bash', 'shell', 'powershell',
  'sql', 'go', 'rust', 'java', 'c', 'cpp', 'csharp',
  'php', 'ruby', 'swift', 'kotlin', 'diff', 'dockerfile', 'vue', 'svelte'
] as const;

function getSharedHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'github-dark', 'light-plus'],
      langs: [...PRELOADED_LANGS],
      engine: createJavaScriptRegexEngine({ forgiving: true })
    }).catch((err) => {
      highlighterPromise = null;
      throw err;
    });
  }
  return highlighterPromise;
}

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  searchSources?: SearchSource[];
}

const injectPythonFileCards = (markdown: string): string => {
  if (!markdown) return markdown;
  const segments = markdown.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  return segments
    .map((segment, index) => {
      if (index % 2 === 1) return segment;
      return segment
        .replace(/\[\[file:([^\[\]\n\r]+?)\]\]/gi, (_m, rawName: string) => {
          const clean = sanitizeWorkspaceFilename(rawName, '');
          if (!clean) return _m;
          return `\n\n[${clean}](#dc-file-${encodeURIComponent(clean)})\n\n`;
        })
        .replace(/deepchat-file:\/\/([^\s)]+)/gi, (_m, rawName: string) => {
          const clean = sanitizeWorkspaceFilename(decodeURIComponent(rawName), '');
          return clean ? `#dc-file-${encodeURIComponent(clean)}` : _m;
        });
    })
    .join('');
};

const injectGroupedCitations = (markdown: string, sources: SearchSource[]): string => {
  if (!markdown || sources.length === 0) return markdown;

  const segments = markdown.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  const adjacentCitationsPattern = /(\[[^\[\]\n]{1,64}\](?!\())(?:\s*,?\s*\[[^\[\]\n]{1,64}\](?!\())*/g;
  const singleBracketPattern = /\[([^\[\]\n]{1,64})\](?!\()/g;

  return segments
    .map((segment, index) => {
      // Odd indices are fenced or inline code blocks, don't touch shit inside them
      if (index % 2 === 1) return segment;
      return segment.replace(adjacentCitationsPattern, run => {
        const bracketMatches = [...run.matchAll(singleBracketPattern)];
        if (bracketMatches.length === 0) return run;

        const resolvedPerBracket = bracketMatches.map(match => ({
          raw: match[0],
          indices: getSourceReferences(match[1], sources)
        }));

        if (resolvedPerBracket.every(item => item.indices.length > 0)) {
          const seen = new Set<number>();
          const ordered: number[] = [];
          for (const item of resolvedPerBracket) {
            for (const sourceIndex of item.indices) {
              if (!seen.has(sourceIndex)) {
                seen.add(sourceIndex);
                ordered.push(sourceIndex);
              }
            }
          }
          if (ordered.length === 0) return run;
          const primaryName = getSourceSiteName(sources[ordered[0]]);
          return `[${primaryName}](#dc-cite-${ordered.join('-')})`;
        }

        // Only part of the run resolved, so only swap the brackets that actually matched
        return run.replace(singleBracketPattern, (singleMatch, inner) => {
          const indices = getSourceReferences(inner, sources);
          if (indices.length === 0) return singleMatch;
          const primaryName = getSourceSiteName(sources[indices[0]]);
          return `[${primaryName}](#dc-cite-${indices.join('-')})`;
        });
      });
    })
    .join('');
};

type MarkdownCodeProps = React.ComponentProps<'code'> & {
  node?: {
    position?: {
      start?: {
        offset?: number;
      };
      end?: {
        offset?: number;
      };
    };
  };
};

type StreamingCodeFence = {
  startOffset: number;
  contentStartOffset: number;
  endOffset: number;
  language: string;
  value: string;
  canMatchByValue: boolean;
};

type MarkdownRenderContextValue = {
  highlighter: Highlighter | null;
  streamingCodeFence: StreamingCodeFence | null;
  searchSources: SearchSource[];
};

const MarkdownRenderContext = React.createContext<MarkdownRenderContextValue>({
  highlighter: null,
  streamingCodeFence: null,
  searchSources: []
});

function MarkdownCode({ className, children, node, ...props }: MarkdownCodeProps) {
  const { highlighter, streamingCodeFence } = useContext(MarkdownRenderContext);
  const match = /language-([\w-]+)/.exec(className || '');
  const language = match ? match[1] : '';
  const isInline = !match;

  if (!isInline) {
    const value = String(children).replace(/\n$/, '');
    return <CodeBlock language={language} value={value} highlighter={highlighter} isStreaming={isCodeBlockStreaming(streamingCodeFence, node, language, value)} />;
  }

  return (
    <code className="bg-slate-100 dark:bg-slate-800 text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded-md font-mono text-[13px] border border-slate-200 dark:border-slate-700" {...props}>
      {children}
    </code>
  );
}

function MarkdownLink({ href, children }: React.ComponentProps<'a'>) {
  const { searchSources } = useContext(MarkdownRenderContext);
  if (typeof href === 'string') {
    const fileMatch = /^#dc-file-([a-zA-Z0-9._%-]+)$/.exec(href);
    if (fileMatch) {
      return <PythonFileCard filename={decodeURIComponent(fileMatch[1])} />;
    }
    const citeMatch = /^#dc-cite-(\d+(?:-\d+)*)$/.exec(href);
    if (citeMatch) {
      const group = citeMatch[1]
        .split('-')
        .map(token => searchSources[Number(token)])
        .filter((source): source is SearchSource => Boolean(source));
      if (group.length > 0) {
        return <CitationPill sources={group} />;
      }
    }
    const linkedSource = getSourceByUrl(href, searchSources);
    if (linkedSource) {
      return <CitationPill sources={[linkedSource]} />;
    }
  }
  return <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline font-medium">{children}</a>;
}

const markdownComponents: Components = {
  code: MarkdownCode as Components['code'],
  p({ children }) {
    const childArray = React.Children.toArray(children);
    if (childArray.length === 1 && React.isValidElement<{ href?: string }>(childArray[0])) {
      const href = childArray[0].props?.href;
      if (typeof href === 'string' && href.startsWith('#dc-file-')) {
        return <PythonFileCard filename={decodeURIComponent(href.slice('#dc-file-'.length))} />;
      }
    }
    return <p className="mb-3 last:mb-0 leading-relaxed text-[15px] dark:text-slate-300">{children}</p>;
  },
  ul({ children }) {
    return <ul className="mb-3 list-disc space-y-1 pl-6 last:mb-0 dark:text-slate-300">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="mb-3 list-decimal space-y-1 pl-6 last:mb-0 dark:text-slate-300">{children}</ol>;
  },
  li({ children }) {
    return <li className="leading-relaxed text-[15px]">{children}</li>;
  },
  h1({ children }) {
    return <h1 className="text-2xl font-bold mt-6 mb-4 text-slate-800 dark:text-slate-100">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-xl font-bold mt-5 mb-3 text-slate-800 dark:text-slate-100">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-lg font-bold mt-4 mb-2 text-slate-800 dark:text-slate-100">{children}</h3>;
  },
  blockquote({ children }) {
    return <blockquote className="my-3 rounded-r-lg border-l-4 border-indigo-200 bg-slate-50/50 py-1 pl-4 italic text-slate-600 last:mb-0 dark:border-indigo-500/30 dark:bg-slate-800/50 dark:text-slate-400">{children}</blockquote>;
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto mb-4 border border-slate-200 dark:border-slate-700 rounded-xl">
        <table className="w-full text-left text-sm whitespace-nowrap">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return <th className="bg-slate-50 dark:bg-slate-800/80 p-3 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">{children}</th>;
  },
  td({ children }) {
    return <td className="p-3 border-b border-slate-100 dark:border-slate-700/50 text-slate-600 dark:text-slate-400">{children}</td>;
  },
  a: MarkdownLink,
  img({ src, alt }) {
    const imageSrc = typeof src === 'string' ? src : '';
    if (!imageSrc) return null;
    return <GeneratedMarkdownImage key={imageSrc} src={imageSrc} alt={alt || 'Generated image'} />;
  }
};

const MarkdownRenderer = React.memo(function MarkdownRenderer({ content, isStreaming = false, searchSources = [] }: MarkdownRendererProps) {
  const [highlighter, setHighlighter] = useState<Highlighter | null>(null);
  const parentInputFiles = usePythonWorkspaceFiles();

  useEffect(() => {
    let active = true;
    getSharedHighlighter()
      .then((instance) => {
        if (active) setHighlighter(instance);
      })
      .catch(console.error);
    return () => {
      active = false;
    };
  }, []);

  const referencedFiles = useMemo(() => extractReferencedPythonFiles(content), [content]);

  const processedContent = injectPythonFileCards(
    injectGroupedCitations(
      content
        .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
        .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$'),
      searchSources
    )
  );
  const streamingCodeFence = isStreaming ? getStreamingCodeFence(processedContent) : null;

  const contextValue = useMemo(
    () => ({ highlighter, streamingCodeFence, searchSources }),
    [highlighter, streamingCodeFence, searchSources]
  );

  return (
    <ClientOnly>
      <PythonFilesProvider files={parentInputFiles} referencedFiles={referencedFiles}>
        <MarkdownRenderContext.Provider value={contextValue}>
          <div className={`prose prose-slate max-w-none break-words dark:prose-invert prose-pre:bg-transparent prose-pre:p-0 prose-p:leading-relaxed prose-a:text-indigo-600 hover:prose-a:text-indigo-700 prose-strong:text-slate-800 dark:prose-strong:text-slate-200 [&>*:last-child]:mb-0 ${isStreaming ? 'dc-sse-streaming' : ''}`}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex]}
              urlTransform={transformMarkdownUrl}
              components={markdownComponents}
            >
              {processedContent}
            </ReactMarkdown>
          </div>
        </MarkdownRenderContext.Provider>
      </PythonFilesProvider>
    </ClientOnly>
  );
});

function getStreamingCodeFence(markdown: string): StreamingCodeFence | null {
  let openFence: {
    char: string;
    length: number;
    startOffset: number;
    contentStartOffset: number;
    language: string;
  } | null = null;
  let lineStart = 0;
  let fencedCodeBlockCount = 0;

  while (lineStart <= markdown.length) {
    const lineEnd = markdown.indexOf('\n', lineStart);
    const currentLineEnd = lineEnd === -1 ? markdown.length : lineEnd;
    const line = markdown.slice(lineStart, currentLineEnd);

    if (openFence) {
      const closingMatch = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
      if (closingMatch && closingMatch[1][0] === openFence.char && closingMatch[1].length >= openFence.length) {
        openFence = null;
      }
    } else {
      const openingMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
      if (openingMatch) {
        fencedCodeBlockCount += 1;
        openFence = {
          char: openingMatch[1][0],
          length: openingMatch[1].length,
          startOffset: lineStart,
          contentStartOffset: lineEnd === -1 ? markdown.length : lineEnd + 1,
          language: normalizeFenceLanguage(openingMatch[2])
        };
      }
    }

    if (lineEnd === -1) break;
    lineStart = lineEnd + 1;
  }

  if (!openFence) return null;

  return {
    startOffset: openFence.startOffset,
    contentStartOffset: openFence.contentStartOffset,
    endOffset: markdown.length,
    language: openFence.language,
    value: markdown.slice(openFence.contentStartOffset).replace(/\n$/, ''),
    canMatchByValue: fencedCodeBlockCount === 1
  };
}

function normalizeFenceLanguage(info: string) {
  return info.trim().split(/\s+/)[0]?.replace(/^language-/, '') || '';
}

function isCodeBlockStreaming(streamingCodeFence: StreamingCodeFence | null, node: MarkdownCodeProps['node'], language: string, value: string) {
  if (!streamingCodeFence) return false;
  const startOffset = node?.position?.start?.offset;
  const endOffset = node?.position?.end?.offset;
  if (typeof startOffset === 'number' && startOffset >= streamingCodeFence.startOffset && startOffset <= streamingCodeFence.contentStartOffset) return true;
  if (typeof endOffset === 'number' && endOffset === streamingCodeFence.endOffset) return true;
  return streamingCodeFence.canMatchByValue && normalizeFenceLanguage(language) === streamingCodeFence.language && value === streamingCodeFence.value;
}

function GeneratedMarkdownImage({ src, alt }: { src: string; alt: string }) {
  const frameRef = useRef<HTMLSpanElement>(null);
  const mediaRef = useRef<HTMLSpanElement>(null);
  const [revealState, setRevealState] = useState<{
    fromWidth: number;
    fromHeight: number;
    toWidth: number;
    toHeight: number;
    natWidth: number;
    natHeight: number;
  } | null>(null);
  const [settled, setSettled] = useState(false);

  const ratio = revealState ? revealState.natWidth / revealState.natHeight : 4 / 3;
  const maxWidth = ratio > 1.25 ? 620 : ratio < 0.85 ? 420 : 480;
  const targetWidth = revealState ? revealState.toWidth : 380;

  useLayoutEffect(() => {
    if (!revealState || settled) return;
    const frameEl = frameRef.current;
    const mediaEl = mediaRef.current;
    if (!frameEl || !mediaEl) return;

    const reduce = prefersReducedMotion();
    if (reduce) {
      gsap.set(frameEl, {
        width: `min(100%, ${Math.min(revealState.toWidth, maxWidth)}px)`,
        aspectRatio: `${revealState.natWidth} / ${revealState.natHeight}`,
      });
      gsap.set(mediaEl, { opacity: 1, scale: 1, filter: 'none' });
      const raf = window.requestAnimationFrame(() => setSettled(true));
      return () => window.cancelAnimationFrame(raf);
    }

    gsap.killTweensOf([frameEl, mediaEl]);
    gsap.set(frameEl, {
      width: revealState.fromWidth,
      height: revealState.fromHeight,
      aspectRatio: 'auto',
    });

    const tl = gsap.timeline({
      onComplete: () => {
        frameEl.style.removeProperty('height');
        frameEl.style.removeProperty('transform');
        mediaEl.style.removeProperty('filter');
        setSettled(true);
      },
    });

    tl.to(
      frameEl,
      {
        width: revealState.toWidth,
        height: revealState.toHeight,
        duration: 0.62,
        ease: 'power3.out',
      },
      0
    ).fromTo(
      mediaEl,
      {
        opacity: 0,
        scale: 1.035,
        filter: 'blur(10px)',
      },
      {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px)',
        duration: 0.56,
        ease: 'power2.out',
        clearProps: 'transform,filter',
      },
      0.08
    );

    return () => {
      tl.kill();
    };
  }, [revealState, settled, maxWidth]);

  return (
    <span
      ref={frameRef}
      className="not-prose dc-img-studio dc-img-studio-frame my-4 block max-w-full"
      style={
        !revealState
          ? {
              width: '380px',
              maxWidth: '100%',
              aspectRatio: '4 / 3',
            }
          : settled
            ? {
                width: `${Math.min(targetWidth, maxWidth)}px`,
                maxWidth: '100%',
                aspectRatio: `${revealState.natWidth} / ${revealState.natHeight}`,
              }
            : undefined
      }
    >
      <span
        ref={mediaRef}
        className={`relative block h-full w-full ${revealState ? '' : 'opacity-0'}`}
      >
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          sizes="(max-width: 640px) 94vw, 620px"
          className="object-cover"
          onLoad={(event) => {
            if (revealState) return;
            const img = event.currentTarget;
            const natWidth = img.naturalWidth || 1024;
            const natHeight = img.naturalHeight || 1024;
            const imgRatio = natWidth / natHeight;

            const frameEl = frameRef.current;
            const parentEl = frameEl?.parentElement;
            const rect = frameEl?.getBoundingClientRect();
            const availW = Math.max(220, Math.round(parentEl?.clientWidth || 640));
            const maxH = Math.min(Math.round((typeof window !== 'undefined' ? window.innerHeight : 800) * 0.68), 580);
            const capW = Math.min(availW, imgRatio > 1.25 ? 620 : imgRatio < 0.85 ? 420 : 480);

            let toWidth = Math.sqrt(188000 * imgRatio);
            let toHeight = toWidth / imgRatio;
            if (toWidth > capW) {
              toWidth = capW;
              toHeight = toWidth / imgRatio;
            }
            if (toHeight > maxH) {
              toHeight = maxH;
              toWidth = toHeight * imgRatio;
            }

            setRevealState({
              fromWidth: Math.max(180, Math.round(rect?.width || Math.min(availW, 380))),
              fromHeight: Math.max(140, Math.round(rect?.height || Math.min(availW, 380) * 0.75)),
              toWidth: Math.round(toWidth),
              toHeight: Math.round(toHeight),
              natWidth,
              natHeight,
            });
          }}
        />
      </span>
    </span>
  );
}

function transformMarkdownUrl(url: string) {
  const value = url.trim();
  // Deny by default so garbage like javascript:, vbscript:, or protocol-relative URLs never make it into a rendered attribute
  if (/^#dc-cite-\d+(?:-\d+)*$/.test(value)) return value;
  if (/^#dc-file-[a-zA-Z0-9._%-]+$/.test(value)) return value;
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value)) return value.replace(/\s/g, '');
  if (/^(https?:|mailto:)/i.test(value)) return value;
  if (/^(?:\.\.\/|\.\/|\/)?[\w~-]+[\w.\/-]*$/.test(value)) return value;
  return '';
}

function CodeBlock({ language, value, highlighter, isStreaming }: { language: string, value: string, highlighter: Highlighter | null, isStreaming: boolean }) {
  // Old model analysis fences show up with no runnable language, render them as dead code blocks only
  let displayLanguage = language;
  if (language.startsWith('deepchat-')) {
    displayLanguage = 'text';
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') displayLanguage = 'json';
    } catch {
    }
  }
  if (extractWebPreviewSource(value, displayLanguage).kind === 'mermaid') {
    return <MermaidDiagramBlock code={value} isStreaming={isStreaming} />;
  }
  if (isPythonLanguage(displayLanguage)) {
    return <PythonPreview value={value} highlighter={highlighter} isStreaming={isStreaming} />;
  }
  return <CodePreview language={displayLanguage} value={value} highlighter={highlighter} isStreaming={isStreaming} />;
}

export default MarkdownRenderer;
