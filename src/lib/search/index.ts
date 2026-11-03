export { runWebSearch, MAX_SEARCH_RESULTS, MAX_SEARCH_CONTEXT_CHARS } from './engine';
export { searchParallel } from './providers/mcp';
export { searchBrave, searchDuckDuckGo, searchWikipedia } from './providers/html';
export { mergeProviderResults, normalizeSearchSource, getHost } from './merge';
export {
  type ProviderFailure, type ProviderNotice,
  type SearchSource,
  type SearchProviderResult,
  type SearchRuntimeItem,
  type WebSearchOutcome
} from './types';
