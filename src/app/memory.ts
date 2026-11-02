import {
  listSavedMemoriesClient,
  upsertSavedMemoryClient,
  deleteSavedMemoryClient,
  clearSavedMemoriesClient,
  listChatHistoryMemoriesClient,
  upsertChatHistoryMemoryClient,
  deleteChatReferencesClient,
  clearChatHistoryClient,
  type SavedMemoryRecord,
  type ChatHistoryMemoryRecord
} from '@/lib/storage/client-storage';

const MAX_MEMORIES = 80;
const MAX_CHAT_HISTORY = 120;
const VECTOR_SIZE = 96;

export interface SavedMemory {
  id: string;
  content: string;
  category: string;
  importance?: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
  sourceProvider?: string;
  sourceModel?: string;
  sourceConnectionId?: string;
  sourceChatId?: string;
  vector?: number[];
}

export interface ChatHistoryMemory {
  id: string;
  chatId?: string;
  userMessage: string;
  assistantMessage: string;
  createdAt: string;
  sourceProvider?: string;
  sourceModel?: string;
  sourceConnectionId?: string;
  sourceUserMessageId?: string;
  vector?: number[];
}

interface MemoryInput {
  content?: string;
  category?: string;
  importance?: 'low' | 'medium' | 'high';
}

interface MemoryMetadata {
  provider?: string;
  model?: string;
  connectionId?: string;
  chatId?: string;
  userMessageId?: string;
}

let serverSavedMemories: SavedMemory[] = [];
let serverHistoryMemories: ChatHistoryMemory[] = [];

const normalizeMemoryText = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

const memorySynonyms: Record<string, string> = {
  stack: 'technology',
  framework: 'technology',
  library: 'technology',
  repo: 'project',
  repository: 'project',
  app: 'project',
  application: 'project',
  pref: 'preference',
  style: 'preference',
  rule: 'instruction',
  constraint: 'instruction',
  guideline: 'instruction',
  job: 'role',
  work: 'role',
  title: 'role',
  name: 'identity',
  alias: 'identity'
};

const stopWords = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'user', 'assistant', 'model', 'like', 'likes', 'want', 'wants', 'prefer', 'prefers',
  'saya', 'aku', 'kami', 'kita', 'kamu', 'anda', 'mereka', 'yang', 'untuk', 'dengan', 'dari', 'pada', 'dalam', 'adalah', 'akan', 'bisa', 'ingin', 'suka'
]);

const tokenizeContext = (text: string) => normalizeMemoryText(text)
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter(token => token.length > 2 && !stopWords.has(token));

const hashToken = (token: string) => {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const vectorizeText = (text: string, category: string = '') => {
  const vector = new Array(VECTOR_SIZE).fill(0);
  const tokens = tokenizeContext(`${category} ${text}`);
  if (tokens.length === 0) return vector;

  for (let index = 0; index < tokens.length; index++) {
    const raw = tokens[index];
    const canonical = memorySynonyms[raw] || raw;
    const bucket = hashToken(canonical) % VECTOR_SIZE;
    const sign = (hashToken(`${canonical}:sign`) % 2 === 0) ? 1 : -1;
    const weight = 1 + (index < 4 ? 0.35 : 0);
    vector[bucket] += sign * weight;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!norm) return vector;
  return vector.map(value => Number((value / norm).toFixed(4)));
};

const cosineSimilarity = (left?: number[], right?: number[]) => {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || left.length === 0) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < left.length; i++) {
    dot += left[i] * right[i];
    leftNorm += left[i] * left[i];
    rightNorm += right[i] * right[i];
  }
  const denom = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  return denom ? Number((dot / denom).toFixed(4)) : 0;
};

const getSavedMemoryVector = (memory: Pick<SavedMemory, 'content' | 'category' | 'vector'>) => {
  if (Array.isArray(memory.vector) && memory.vector.length === VECTOR_SIZE) return memory.vector;
  return vectorizeText(memory.content, memory.category);
};

const getHistoryMemoryVector = (memory: Pick<ChatHistoryMemory, 'userMessage' | 'assistantMessage' | 'vector'>) => {
  if (Array.isArray(memory.vector) && memory.vector.length === VECTOR_SIZE) return memory.vector;
  return vectorizeText(`${memory.userMessage} ${memory.assistantMessage}`);
};

const scoreHistory = (queryTokens: string[], queryVector: number[], memory: ChatHistoryMemory, index: number) => {
  const textTokens = tokenizeContext(`${memory.userMessage} ${memory.assistantMessage}`);
  const overlap = getTokenOverlap(new Set(queryTokens), new Set(textTokens));
  const semantic = Math.max(0, cosineSimilarity(queryVector, getHistoryMemoryVector(memory)));
  const recency = Math.max(0, 1 - index / MAX_CHAT_HISTORY);
  return semantic * 0.65 + overlap * 0.25 + recency * 0.1;
};

const normalizeMemoryToken = (token: string) => memorySynonyms[token] || token;

const getMemoryTokens = (content: string, category: string = '') => new Set(
  normalizeMemoryText(`${category} ${content}`)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(normalizeMemoryToken)
    .filter(token => token.length > 2 && !stopWords.has(token))
);

const getTokenOverlap = (left: Set<string>, right: Set<string>) => {
  if (left.size === 0 || right.size === 0) return 0;
  let matches = 0;
  for (const token of left) {
    if (right.has(token)) matches += 1;
  }
  const denominator = Math.max(1, Math.min(left.size, right.size));
  return Number((matches / denominator).toFixed(4));
};

const areSimilarSavedMemories = (left: { content: string; category?: string }, right: { content: string; category?: string }) => {
  const leftNormalized = normalizeMemoryText(left.content);
  const rightNormalized = normalizeMemoryText(right.content);
  if (leftNormalized === rightNormalized) return true;
  if (leftNormalized.includes(rightNormalized) || rightNormalized.includes(leftNormalized)) return true;
  const leftTokens = getMemoryTokens(left.content, left.category);
  const rightTokens = getMemoryTokens(right.content, right.category);
  const overlap = getTokenOverlap(leftTokens, rightTokens);
  if (overlap >= 0.72) return true;
  const similarity = cosineSimilarity(vectorizeText(left.content, left.category || ''), vectorizeText(right.content, right.category || ''));
  return similarity >= 0.86;
};

const importanceRank = (importance?: 'low' | 'medium' | 'high') => {
  if (importance === 'high') return 3;
  if (importance === 'low') return 1;
  return 2;
};

const choosePreferredMemory = (current: SavedMemory, incoming: SavedMemory) => {
  const currentRank = importanceRank(current.importance);
  const incomingRank = importanceRank(incoming.importance);
  if (incomingRank > currentRank) return incoming;
  if (incomingRank < currentRank) return current;
  if (incoming.content.length > current.content.length) return incoming;
  return current;
};

const normalizeSavedMemory = (memory: SavedMemory): SavedMemory => ({
  ...memory,
  category: memory.category?.trim() || 'General',
  importance: memory.importance || 'medium',
  vector: getSavedMemoryVector(memory)
});

const normalizeHistoryMemory = (memory: ChatHistoryMemory): ChatHistoryMemory => ({
  ...memory,
  vector: getHistoryMemoryVector(memory)
});

const dedupeSavedMemoryList = (memories: SavedMemory[]) => {
  const result: SavedMemory[] = [];
  for (const memory of memories) {
    const existingIndex = result.findIndex(item => areSimilarSavedMemories(item, memory));
    if (existingIndex === -1) {
      result.push(normalizeSavedMemory(memory));
    } else {
      result[existingIndex] = choosePreferredMemory(result[existingIndex], normalizeSavedMemory(memory));
    }
  }
  return result;
};

export async function ensureMemoryFile() {}

export async function getSavedMemories(): Promise<SavedMemory[]> {
  if (typeof window !== 'undefined') {
    const list = await listSavedMemoriesClient();
    return dedupeSavedMemoryList(list.map(normalizeSavedMemory)).slice(0, MAX_MEMORIES);
  }
  return dedupeSavedMemoryList(serverSavedMemories).slice(0, MAX_MEMORIES);
}

const scoreSavedMemory = (queryTokens: string[], queryVector: number[], memory: SavedMemory, index: number) => {
  const memoryTokens = getMemoryTokens(memory.content, memory.category);
  const overlap = getTokenOverlap(new Set(queryTokens), memoryTokens);
  const semantic = Math.max(0, cosineSimilarity(queryVector, getSavedMemoryVector(memory)));
  const importance = importanceRank(memory.importance) / 3;
  const recency = Math.max(0, 1 - index / MAX_MEMORIES);
  return semantic * 0.58 + overlap * 0.24 + importance * 0.1 + recency * 0.08;
};

export async function getRelevantSavedMemories(query: string, limit = 12): Promise<SavedMemory[]> {
  const memories = await getSavedMemories();
  const queryTokens = tokenizeContext(query).map(normalizeMemoryToken);
  const queryVector = vectorizeText(query);

  if (queryTokens.length === 0) {
    return memories
      .sort((a, b) => importanceRank(b.importance) - importanceRank(a.importance) || new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime())
      .slice(0, Math.min(limit, 8));
  }

  return memories
    .map((memory, index) => ({
      memory,
      score: scoreSavedMemory(queryTokens, queryVector, memory, index)
    }))
    .filter(item => item.score > 0.18)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.memory);
}

export async function saveExtractedMemories(items: MemoryInput[], metadata: MemoryMetadata = {}) {
  const existing = await getSavedMemories();
  const now = new Date().toISOString();
  const seen = new Set(existing.map(memory => normalizeMemoryText(memory.content)));
  const saved: SavedMemory[] = [];
  const next = [...existing];
  let changed = false;

  for (const item of items) {
    const content = typeof item?.content === 'string' ? item.content.replace(/\s+/g, ' ').trim() : '';
    if (!content || content.length < 8 || content.length > 260) continue;
    const normalized = normalizeMemoryText(content);
    if (seen.has(normalized)) continue;

    const memoryId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `m_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const memory: SavedMemory = {
      id: memoryId,
      content,
      category: item.category?.replace(/\s+/g, ' ').trim() || 'General',
      importance: item.importance || 'medium',
      createdAt: now,
      updatedAt: now,
      sourceProvider: metadata.provider,
      sourceModel: metadata.model,
      sourceConnectionId: metadata.connectionId,
      sourceChatId: metadata.chatId,
      vector: vectorizeText(content, item.category || 'General')
    };

    const duplicateIndex = next.findIndex(existingMemory => areSimilarSavedMemories(existingMemory, memory));
    if (duplicateIndex !== -1) {
      const preferred = choosePreferredMemory(next[duplicateIndex], memory);
      if (preferred.id !== next[duplicateIndex].id) {
        next[duplicateIndex] = {
          ...preferred,
          updatedAt: now
        };
        changed = true;
      }
      seen.add(normalized);
      continue;
    }

    seen.add(normalized);
    next.unshift(memory);
    saved.push(memory);
    changed = true;
  }

  if (changed) {
    const deduped = dedupeSavedMemoryList(next).slice(0, MAX_MEMORIES);
    if (typeof window !== 'undefined') {
      for (const m of deduped) {
        await upsertSavedMemoryClient(m as SavedMemoryRecord);
      }
    } else {
      serverSavedMemories = deduped;
    }
  }

  return saved;
}

export async function recordChatHistoryMemory(userMessage: string, assistantMessage: string, metadata: MemoryMetadata = {}) {
  const cleanUser = userMessage.replace(/\s+/g, ' ').trim();
  const cleanAssistant = assistantMessage.replace(/\s+/g, ' ').trim();
  if (!cleanUser || !cleanAssistant) return null;
  const userTokens = tokenizeContext(cleanUser);
  const assistantTokens = tokenizeContext(cleanAssistant);
  const explicitMemoryIntent = /\b(?:ingat|remember|catat|save|panggil|call me|nama saya|nama aku|nama gue|nama gua|nama gw|my name is)\b/i.test(cleanUser);
  if (!explicitMemoryIntent && (userTokens.length < 3 || userTokens.length + assistantTokens.length < 12)) return null;

  const existing = await getChatHistoryMemories();
  const duplicateIndex = existing.findIndex(item => {
    if (metadata.userMessageId && item.sourceUserMessageId === metadata.userMessageId) return true;
    if (!metadata.userMessageId && item.chatId === metadata.chatId && normalizeMemoryText(item.userMessage) === normalizeMemoryText(cleanUser)) {
      return cosineSimilarity(getHistoryMemoryVector(item), vectorizeText(`${cleanUser} ${cleanAssistant}`)) > 0.72;
    }
    return false;
  });

  const entryId = duplicateIndex === -1
    ? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `h_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`)
    : existing[duplicateIndex].id;

  const entry: ChatHistoryMemory = {
    id: entryId,
    chatId: metadata.chatId,
    userMessage: cleanUser.slice(0, 600),
    assistantMessage: cleanAssistant.slice(0, 900),
    createdAt: duplicateIndex === -1 ? new Date().toISOString() : existing[duplicateIndex].createdAt,
    sourceProvider: metadata.provider,
    sourceModel: metadata.model,
    sourceConnectionId: metadata.connectionId,
    sourceUserMessageId: metadata.userMessageId,
    vector: vectorizeText(`${cleanUser} ${cleanAssistant}`)
  };

  const next = duplicateIndex === -1
    ? [entry, ...existing]
    : [entry, ...existing.filter((_, index) => index !== duplicateIndex)];

  const bounded = next.slice(0, MAX_CHAT_HISTORY);
  if (typeof window !== 'undefined') {
    await upsertChatHistoryMemoryClient(entry as ChatHistoryMemoryRecord);
  } else {
    serverHistoryMemories = bounded;
  }
  return entry;
}

export async function getChatHistoryMemories(): Promise<ChatHistoryMemory[]> {
  if (typeof window !== 'undefined') {
    const list = await listChatHistoryMemoriesClient();
    return list.map(normalizeHistoryMemory).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }
  return serverHistoryMemories.map(normalizeHistoryMemory).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

export async function getRelevantChatHistoryMemories(query: string, limit = 8): Promise<ChatHistoryMemory[]> {
  const history = await getChatHistoryMemories();
  const queryTokens = tokenizeContext(query).map(normalizeMemoryToken);
  const queryVector = vectorizeText(query);
  if (queryTokens.length === 0) return history.slice(0, Math.min(limit, 4));

  const ranked = history
    .map((memory, index) => ({
      memory,
      score: scoreHistory(queryTokens, queryVector, memory, index)
    }))
    .filter(item => item.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .map(item => item.memory);

  return ranked.slice(0, limit);
}

export async function deleteSavedMemory(id: string) {
  if (typeof window !== 'undefined') {
    return deleteSavedMemoryClient(id);
  }
  serverSavedMemories = serverSavedMemories.filter(m => m.id !== id);
  return true;
}

export async function clearSavedMemories() {
  if (typeof window !== 'undefined') {
    return clearSavedMemoriesClient();
  }
  serverSavedMemories = [];
  return true;
}

export async function clearChatHistory() {
  if (typeof window !== 'undefined') {
    return clearChatHistoryClient();
  }
  serverHistoryMemories = [];
  return true;
}

export async function deleteChatReferences(chatId: string) {
  if (typeof window !== 'undefined') {
    return deleteChatReferencesClient(chatId);
  }
  serverHistoryMemories = serverHistoryMemories.filter(m => m.chatId !== chatId);
  return true;
}
