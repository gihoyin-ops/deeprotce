import { parseGeneratedClarificationAnswerContent } from '@/lib/agent/agent-clarification';
import { extractUrlContent } from '@/lib/search/extract';
import { getHost, normalizeSearchSource, runWebSearch, type SearchSource } from '@/lib/search';

export interface ChatToolRuntimeItem {
  toolId: string;
  name: string;
  description: string;
  category: string;
  env: string[];
  tags: string[];
  config: Record<string, string>;
  configured: boolean;
  missingEnv: string[];
}

export interface SearchRuntimeOutcome {
  context: string;
  sources: SearchSource[];
  readSources: SearchSource[];
  searched: boolean;
}

const MAX_URL_CONTEXT_URLS = 3;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object');
const asStringArray = (value: unknown) => (Array.isArray(value) ? value.filter(item => typeof item === 'string') : []);

const sanitizePrompt = (prompt: string) => {
  const clarificationAnswer = parseGeneratedClarificationAnswerContent(prompt);
  if (!clarificationAnswer) return prompt;
  return [
    clarificationAnswer.question ? `Clarification question: ${clarificationAnswer.question}` : '',
    `Clarification answer ${clarificationAnswer.shortcut}: ${clarificationAnswer.value}`
  ]
    .filter(Boolean)
    .join('\n');
};

const normalizeConfig = (value: unknown) => {
  if (!isRecord(value)) return {};
  return Object.entries(value).reduce<Record<string, string>>((config, [key, configValue]) => {
    if (typeof configValue === 'string') config[key] = configValue;
    return config;
  }, {});
};

export const normalizeChatTools = (value: unknown): ChatToolRuntimeItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map(tool => ({
      toolId: typeof tool.toolId === 'string' ? tool.toolId : '',
      name: typeof tool.name === 'string' ? tool.name : '',
      description: typeof tool.description === 'string' ? tool.description : '',
      category: typeof tool.category === 'string' ? tool.category : '',
      env: asStringArray(tool.env),
      tags: asStringArray(tool.tags),
      config: normalizeConfig(tool.config),
      configured: tool.configured === true,
      missingEnv: asStringArray(tool.missingEnv)
    }))
    .filter(tool => tool.toolId && tool.name);
};

const extractUrls = (text: string) => {
  const matches = text.match(/https?:\/\/[^\s<>"']+/gi) || [];
  return Array.from(new Set(matches.map(url => url.replace(/[),.;!?]+$/g, '')))).slice(0, MAX_URL_CONTEXT_URLS);
};

export const collectSearchRuntimeContext = async (
  tools: ChatToolRuntimeItem[],
  latestUserMessage: string
): Promise<SearchRuntimeOutcome> => {
  const searchTools = tools.filter(tool => tool.toolId !== 'url-context');
  const urlContextEnabled = tools.some(tool => tool.toolId === 'url-context' && tool.configured);
  const runtimePrompt = sanitizePrompt(latestUserMessage).replace(/\s+/g, ' ').trim();
  const urls = extractUrls(latestUserMessage);

  const searchPromise =
    searchTools.length > 0 && runtimePrompt
      ? runWebSearch(searchTools, runtimePrompt)
      : Promise.resolve(null);

  const pagesPromise =
    urlContextEnabled && urls.length > 0
      ? Promise.all(
          urls.map(async url => {
            try {
              const page = await extractUrlContent(url);
              if (!page.text) return null;
              const normalized = normalizeSearchSource({
                url: page.url,
                title: getHost(page.url) || page.url,
                snippet: page.text.slice(0, 260)
              });
              return {
                contextLine: `Source: ${page.url}\n${page.text}`,
                source: normalized
              };
            } catch {
              return null;
            }
          })
        )
      : Promise.resolve(null);

  const [searchResult, pages] = await Promise.all([searchPromise, pagesPromise]);
  const contextParts: string[] = [];
  const readSources: SearchSource[] = [];

  if (searchResult?.context) {
    contextParts.push(searchResult.context);
  }
  if (pages) {
    for (const page of pages) {
      if (!page) continue;
      contextParts.push(page.contextLine);
      if (page.source) readSources.push(page.source);
    }
  }

  return {
    context: contextParts.join('\n\n'),
    sources: searchResult?.sources || [],
    readSources,
    searched: Boolean(searchTools.length > 0 && runtimePrompt)
  };
};

export const buildSearchSystemPrompt = (context: string, hasSources: boolean): string => {
  if (!context) return '';
  return [
    'Web search context:',
    context,
    hasSources
      ? 'Use the provided web sources when relevant to answer directly and accurately. Cite source numbers inline (for example [1] or [1, 2]) right after claims supported by those sources. Never invent URLs or titles, never mention search engines or rate limits, and never open your answer with filler like "Searching for...".'
      : 'If no relevant web results were returned, answer from your own knowledge without mentioning search tools, search engines, or errors.'
  ].join('\n\n');
};
