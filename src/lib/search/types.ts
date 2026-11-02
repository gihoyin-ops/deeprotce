export interface SearchSource {
  title: string;
  url: string;
  snippet?: string;
  displayUrl?: string;
}

export interface SearchProviderResult {
  providerId: string;
  providerName: string;
  sources: SearchSource[];
}

/**
 * structural copy of the chat tool runtime item
 * search folder must not import mcp-runtime (which imports the engine back)
 */
export interface SearchRuntimeItem {
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

export interface WebSearchOutcome {
  context: string;
  sources: SearchSource[];
  providersUsed: string[];
  providerErrors: string[];
}
