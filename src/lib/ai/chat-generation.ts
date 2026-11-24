'use client';

import { getChat, saveMessage, updateChatTitle } from '@/app/actions';
import { getInjectedSystemPrompt } from '@/app/persona';
import { saveExtractedMemories, recordChatHistoryMemory } from '@/app/memory';
import { publishDeepChatNotification } from '@/lib/settings/notification-settings';
import { getEnabledToolRuntimeItems } from '@/lib/settings/tool-settings';
import { parseAgentClarification, parseGeneratedClarificationAnswerContent, type AgentClarification } from '@/lib/agent/agent-clarification';
import { getGenerationMode, stripGeneratedImageMarkdown, type GenerationMode } from '@/lib/images/image-generation';
import { normalizeImageAspectRatio, type ImageAspectRatio } from '@/lib/images/image-aspect-ratio';
import type { SearchSource, SearchStatus, ThinkingStep } from '@/lib/search/source-display';
import {
  getLatestUserMessage,
  shouldRequestImageGeneration
} from '@/lib/agent/backend-tools';

interface MemoryApiMessage {
  id?: string;
  role: string;
  content?: string;
}

interface MemoryAssistantMessage {
  id: string;
  content?: string;
  [key: string]: unknown;
}

interface ChatApiMessage {
  id?: string;
  role: string;
  content?: string;
  attachedFiles?: unknown;
  webSearchEnabled?: boolean;
  imageGenerationEnabled?: boolean;
  imageAspectRatio?: ImageAspectRatio;
  [key: string]: unknown;
}

interface ChatMessageVersion {
  content?: string;
  reasoning?: string;
  reasoningDuration?: number;
  searchStatus?: SearchStatus;
  searchSources?: SearchSource[];
  readSources?: SearchSource[];
  thinkingSteps?: ThinkingStep[];
  clarification?: AgentClarification;
  versionIndex?: number;
  generationMode?: GenerationMode;
  [key: string]: unknown;
}

interface StoredChatMessage extends MemoryAssistantMessage {
  reasoning?: string;
  reasoningDuration?: number;
  searchStatus?: SearchStatus;
  searchSources?: SearchSource[];
  readSources?: SearchSource[];
  thinkingSteps?: ThinkingStep[];
  clarification?: AgentClarification;
  versions?: ChatMessageVersion[];
  currentVersionIndex?: number;
  isStreaming?: boolean;
  isError?: boolean;
  isStopped?: boolean;
  generationMode?: GenerationMode;
}

interface SelectedModelConnection {
  connectionId?: string;
  id?: string;
}

export interface ChatGenerationSnapshot {
  chatId: string;
  assistantMsgId: string;
  content: string;
  reasoning: string;
  searchStatus: SearchStatus;
  searchHasReasoning: boolean;
  searchSources: SearchSource[];
  readSources: SearchSource[];
  thinkingSteps: ThinkingStep[];
  clarification?: AgentClarification;
  isStreaming: boolean;
  isError?: boolean;
  isStopped?: boolean;
  reasoningDuration?: number;
  generationMode?: GenerationMode;
  status: 'running' | 'completed' | 'stopped' | 'error';
}

export interface ImageEditRequestPayload {
  mode: 'edit' | 'annotate' | 'resize' | 'remove';
  prompt: string;
  sourceImageDataUrl: string;
  maskDataUrl?: string;
  annotatedDataUrl?: string;
}

interface ChatGenerationTask {
  chatId: string;
  assistantMsgId: string;
  apiMessages: ChatApiMessage[];
  controller: AbortController;
  fullContent: string;
  fullReasoning: string;
  displayedContent: string;
  displayedReasoning: string;
  searchStatus: SearchStatus;
  searchHasReasoning: boolean;
  searchSources: SearchSource[];
  readSources: SearchSource[];
  thinkingSteps: ThinkingStep[];
  clarification?: AgentClarification;
  startedAt: number;
  reasoningEndTime: number;
  status: ChatGenerationSnapshot['status'];
  stopRequested: boolean;
  connection: SelectedModelConnection | null;
  generationMode?: GenerationMode;
  imageEdit?: ImageEditRequestPayload;
  promise?: Promise<void>;
  lastEmittedAt: number;
  pendingEmit: ReturnType<typeof setTimeout> | null;
  rafId: number | null;
}

const tasks = new Map<string, ChatGenerationTask>();
const listeners = new Map<string, Set<(snapshot: ChatGenerationSnapshot) => void>>();

const getResponseError = async (res: Response) => {
  try {
    const data = await res.clone().json();
    // server sends a human message next to the code, show the sentence
    return data?.message || data?.error || null;
  } catch {
    try {
      const text = await res.text();
      if (text) return text;
    } catch {
    }
    return `Request failed with status ${res.status}`;
  }
};

const isGenericChatTitle = (title?: string) => {
  const normalized = (title || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return !normalized || normalized === 'new chat' || normalized === 'untitled chat' || normalized === 'untitled conversation';
};

const normalizeVersions = (versions: ChatMessageVersion[] = []) => versions.map((version, index) => ({
  ...version,
  versionIndex: typeof version?.versionIndex === 'number' ? version.versionIndex : index + 1
}));

const getDuration = (task: ChatGenerationTask) => {
  let durationSec = Math.round((task.reasoningEndTime - task.startedAt) / 1000);
  if (durationSec === 0 && task.fullReasoning) {
    durationSec = 1;
  }
  return task.fullReasoning ? durationSec : undefined;
};

const getPacedThinkingSteps = (steps: ThinkingStep[], charBudget: number, isRunning: boolean): ThinkingStep[] => {
  if (!isRunning) return [...steps];
  let remaining = charBudget;
  const paced: ThinkingStep[] = [];
  for (const step of steps) {
    if (step.type !== 'thought') {
      paced.push(step);
      continue;
    }
    if (remaining <= 0) continue;
    if (step.text.length <= remaining) {
      paced.push(step);
      remaining -= step.text.length;
    } else {
      paced.push({ type: 'thought', text: step.text.slice(0, remaining) });
      remaining = 0;
    }
  }
  return paced;
};

const getSnapshot = (task: ChatGenerationTask): ChatGenerationSnapshot => {
  const isRunning = task.status === 'running';
  return {
    chatId: task.chatId,
    assistantMsgId: task.assistantMsgId,
    content: isRunning ? task.displayedContent : task.fullContent,
    reasoning: isRunning ? task.displayedReasoning : task.fullReasoning,
    searchStatus: task.searchStatus,
    searchHasReasoning: task.searchHasReasoning,
    searchSources: task.searchSources,
    readSources: task.readSources,
    thinkingSteps: getPacedThinkingSteps(task.thinkingSteps, task.displayedReasoning.length, isRunning),
    clarification: task.clarification,
    isStreaming: isRunning,
    isError: task.status === 'error',
    isStopped: task.status === 'stopped',
    reasoningDuration: getDuration(task),
    generationMode: task.generationMode,
    status: task.status
  };
};

const dispatchSnapshot = (task: ChatGenerationTask) => {
  const snapshot = getSnapshot(task);
  listeners.get(task.chatId)?.forEach(listener => listener(snapshot));
};

const stopSmoothRaf = (task: ChatGenerationTask) => {
  if (task.rafId !== null && typeof window !== 'undefined') {
    window.cancelAnimationFrame(task.rafId);
    task.rafId = null;
  }
};

const stepSmoothEmit = (task: ChatGenerationTask) => {
  task.rafId = null;
  if (task.status !== 'running') {
    task.displayedContent = task.fullContent;
    task.displayedReasoning = task.fullReasoning;
    dispatchSnapshot(task);
    return;
  }

  let advanced = false;
  const rDiff = task.fullReasoning.length - task.displayedReasoning.length;
  if (rDiff > 0) {
    const step = Math.max(3, Math.ceil(rDiff * 0.28));
    task.displayedReasoning = task.fullReasoning.slice(0, task.displayedReasoning.length + step);
    advanced = true;
  }

  const cDiff = task.fullContent.length - task.displayedContent.length;
  if (cDiff > 0) {
    const step = Math.max(2, Math.ceil(cDiff * 0.25));
    task.displayedContent = task.fullContent.slice(0, task.displayedContent.length + step);
    advanced = true;
  }

  if (advanced) {
    task.lastEmittedAt = Date.now();
    dispatchSnapshot(task);
  }

  if (
    task.displayedContent.length < task.fullContent.length ||
    task.displayedReasoning.length < task.fullReasoning.length
  ) {
    if (typeof window !== 'undefined') {
      task.rafId = window.requestAnimationFrame(() => stepSmoothEmit(task));
    }
  }
};

const emitSnapshot = (task: ChatGenerationTask, immediate = false) => {
  if (task.pendingEmit) {
    clearTimeout(task.pendingEmit);
    task.pendingEmit = null;
  }

  if (task.status !== 'running') {
    stopSmoothRaf(task);
    task.displayedContent = task.fullContent;
    task.displayedReasoning = task.fullReasoning;
    task.lastEmittedAt = Date.now();
    dispatchSnapshot(task);
    return;
  }

  if (immediate) {
    task.lastEmittedAt = Date.now();
    dispatchSnapshot(task);
    return;
  }

  if (task.rafId === null && typeof window !== 'undefined') {
    task.rafId = window.requestAnimationFrame(() => stepSmoothEmit(task));
  }
};

const formatMessages = (apiMessages: ChatApiMessage[]) => {
  const sanitizeContent = (content?: string) => stripGeneratedImageMarkdown(parseAgentClarification(content || '').visibleContent);
  const latestRealUser = (items: ChatApiMessage[]) => [...items].reverse().find(item => item.role === 'user' && !parseGeneratedClarificationAnswerContent(item.content));
  if (apiMessages.length <= 1) {
    return apiMessages.map(m => ({ role: m.role, content: sanitizeContent(m.content), attachedFiles: m.attachedFiles, webSearchEnabled: m.webSearchEnabled, imageGenerationEnabled: m.imageGenerationEnabled, imageAspectRatio: m.imageAspectRatio }));
  }

  const history = apiMessages.slice(0, -1);
  const lastMsg = apiMessages[apiMessages.length - 1];
  const clarificationAnswer = parseGeneratedClarificationAnswerContent(lastMsg.content);
  const originalUserMessage = clarificationAnswer ? latestRealUser(history) : undefined;
  const runtimePromptContent = clarificationAnswer
    ? [
      sanitizeContent(originalUserMessage?.content),
      clarificationAnswer.question ? `Clarification question: ${clarificationAnswer.question}` : '',
      `Clarification answer ${clarificationAnswer.shortcut}: ${clarificationAnswer.value}`
    ].filter(Boolean).join('\n\n')
    : undefined;
  let sysContent = "You are a helpful AI assistant. Below is the history of the current conversation.\n\n=== CHAT HISTORY ===\n";

  history.forEach(m => {
    const role = m.role === 'user' ? 'User' : 'Assistant';
    sysContent += `${role}: ${sanitizeContent(m.content)}\n\n`;
  });

  sysContent += "=== END OF HISTORY ===\n\nPlease respond to the user's latest message based on the context above.";

  return [
    { role: 'system', content: sysContent },
    { role: 'user', content: sanitizeContent(lastMsg.content), attachedFiles: lastMsg.attachedFiles, webSearchEnabled: lastMsg.webSearchEnabled, imageGenerationEnabled: lastMsg.imageGenerationEnabled, imageAspectRatio: lastMsg.imageAspectRatio, runtimePromptContent }
  ];
};

const getSelectedConnection = (): SelectedModelConnection | null => {
  const selectedModelStr = localStorage.getItem('selectedModelObj');
  return selectedModelStr ? JSON.parse(selectedModelStr) : null;
};

const updateMessageVersion = (
  message: StoredChatMessage,
  content: string,
  reasoning: string,
  reasoningDuration?: number,
  searchStatus: SearchStatus = 'idle',
  searchSources: SearchSource[] = [],
  readSources: SearchSource[] = [],
  thinkingSteps: ThinkingStep[] = [],
  clarification?: AgentClarification,
  generationMode?: GenerationMode
) => {
  const updated = {
    ...message,
    content,
    reasoning,
    reasoningDuration,
    searchStatus,
    searchSources,
    readSources,
    thinkingSteps,
    clarification,
    generationMode
  };

  if (updated.versions && updated.currentVersionIndex !== undefined) {
    updated.versions = normalizeVersions(updated.versions);
    updated.versions[updated.currentVersionIndex] = {
      ...updated.versions[updated.currentVersionIndex],
      content,
      reasoning,
      reasoningDuration,
      searchStatus,
      searchSources,
      readSources,
      thinkingSteps,
      clarification,
      generationMode
    };
  }

  return updated;
};

const getAssistantMessage = async (chatId: string, assistantMsgId: string) => {
  const chat = await getChat(chatId);
  const messages = Array.isArray(chat?.messages) ? chat.messages as StoredChatMessage[] : [];
  return messages.find(m => m.id === assistantMsgId) || null;
};

const saveFinalMessage = async (task: ChatGenerationTask, options: { isError?: boolean; isStopped?: boolean; errorMessage?: string } = {}) => {
  const currentMsg = await getAssistantMessage(task.chatId, task.assistantMsgId);
  if (!currentMsg) return null;

  const parsedContent = parseAgentClarification(task.fullContent);
  const clarification = task.clarification || parsedContent.clarification;
  const content = options.errorMessage || parsedContent.visibleContent || (options.isStopped ? 'Done, finished up.' : '');
  const finalSearchStatus: SearchStatus = task.searchSources.length > 0 ? 'completed' : 'idle';
  const finalMessage = {
    ...updateMessageVersion(
      currentMsg,
      content,
      task.fullReasoning,
      getDuration(task),
      finalSearchStatus,
      task.searchSources,
      task.readSources,
      task.thinkingSteps,
      clarification,
      task.generationMode
    ),
    isStreaming: false,
    isError: options.isError === true,
    isStopped: options.isStopped === true
  };

  await saveMessage(task.chatId, finalMessage);
  return finalMessage;
};

const generateChatTitle = async (chatId: string, prompt: string, connection: SelectedModelConnection | null) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const titleRes = await fetch('/api/chat/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          connectionId: connection?.connectionId,
          modelId: connection?.id
        })
      });
      if (!titleRes.ok) continue;
      const { title } = await titleRes.json();
      if (!isGenericChatTitle(title)) {
        await updateChatTitle(chatId, title);
        window.dispatchEvent(new CustomEvent('chatUpdated', { detail: { chatId, title } }));
        return title;
      }
    } catch {
    }
  }
  return null;
};

const saveMemoriesFromResponse = async (chatId: string, apiMessages: MemoryApiMessage[], assistantMessage: MemoryAssistantMessage, connection: SelectedModelConnection | null) => {
  const lastUserMessage = [...apiMessages].reverse().find(m => m.role === 'user');
  const assistantMemoryContent = stripGeneratedImageMarkdown(assistantMessage.content);
  if (!lastUserMessage?.content || !assistantMemoryContent || !assistantMemoryContent.trim() || assistantMemoryContent === '[generated image omitted]') return;

  try {
    const res = await fetch('/api/memory/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        userMessage: lastUserMessage.content,
        userMessageId: lastUserMessage.id,
        assistantMessage: assistantMemoryContent,
        connectionId: connection?.connectionId,
        modelId: connection?.id
      })
    });
    if (!res.ok) return;
    const data = await res.json();
    const metadata = {
      provider: typeof data?.provider === 'string' ? data.provider : undefined,
      model: typeof data?.model === 'string' ? data.model : connection?.id,
      connectionId: connection?.connectionId,
      chatId,
      userMessageId: lastUserMessage.id
    };

    let clientSavedCount = 0;
    if (Array.isArray(data?.memories) && data.memories.length > 0) {
      const saved = await saveExtractedMemories(data.memories, metadata);
      clientSavedCount = saved.length;
    }
    await recordChatHistoryMemory(lastUserMessage.content, assistantMemoryContent, metadata);

    const totalCount = clientSavedCount || data?.savedCount || 0;
    if (!totalCount) return;

    const updatedMessage = {
      ...assistantMessage,
      memoriesSaved: true,
      memoriesSavedCount: totalCount,
      memoryProvider: data.provider,
      memoryModel: data.model
    };

    await saveMessage(chatId, updatedMessage);
    window.dispatchEvent(new CustomEvent('chatUpdated', { detail: { chatId } }));
  } catch {
  }
};

const getErrorMessage = (error: unknown) => {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return '';
};

const isAbortError = (error: unknown) => {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === 'object');
};

const getString = (value: unknown) => typeof value === 'string' ? value : '';

const getOpenAiDelta = (json: Record<string, unknown>) => {
  const choices = Array.isArray(json.choices) ? json.choices : [];
  const choice = isRecord(choices[0]) ? choices[0] : null;
  const delta = choice && isRecord(choice.delta) ? choice.delta : null;
  return {
    reasoning: getString(delta?.reasoning_content),
    content: getString(delta?.content)
  };
};

const getGeminiText = (json: Record<string, unknown>) => {
  const directText = getString(json.text);
  if (directText) return directText;

  const candidates = Array.isArray(json.candidates) ? json.candidates : [];
  const candidate = isRecord(candidates[0]) ? candidates[0] : null;
  const content = candidate && isRecord(candidate.content) ? candidate.content : null;
  const parts = content && Array.isArray(content.parts) ? content.parts : [];
  return parts.map(part => isRecord(part) ? getString(part.text) : '').join('');
};

const normalizeSearchSources = (value: unknown): SearchSource[] => {
  if (!Array.isArray(value)) return [];
  const sources = value.map((item): SearchSource | null => {
    if (!isRecord(item)) return null;
    const title = getString(item.title);
    const url = getString(item.url);
    if (!url) return null;
    const siteName = getString(item.siteName);
    const publishedDate = getString(item.publishedDate);
    return {
      title: title || url,
      url,
      snippet: getString(item.snippet),
      displayUrl: getString(item.displayUrl),
      ...(siteName ? { siteName } : {}),
      ...(publishedDate ? { publishedDate } : {})
    };
  }).filter((item): item is SearchSource => Boolean(item));
  return sources;
};

const finishSuccessfulTask = async (task: ChatGenerationTask) => {
  if (!task.fullContent && !task.fullReasoning && !task.clarification) {
    throw new Error('The provider returned an empty response.');
  }

  task.status = 'completed';
  let finalMessage: StoredChatMessage | null = null;
  try {
    finalMessage = await saveFinalMessage(task);
  } catch {
    finalMessage = null;
  }
  emitSnapshot(task, true);

  if (finalMessage) {
    void saveMemoriesFromResponse(task.chatId, task.apiMessages, finalMessage, task.connection);
    const currentChat = await getChat(task.chatId);
    const latestUserPrompt = [...task.apiMessages].reverse().find(m => m.role === 'user')?.content;
    if (latestUserPrompt && isGenericChatTitle(currentChat?.title)) {
      try {
        await generateChatTitle(task.chatId, latestUserPrompt, task.connection);
      } catch {
      }
    }
  }

  publishDeepChatNotification({
    id: `generation-finished-${task.chatId}-${task.assistantMsgId}`,
    type: 'responseFinished',
    title: 'Response finished',
    description: 'Your background response is ready to read.',
    severity: 'success',
    chatId: task.chatId,
    href: `/chat/${task.chatId}`
  });
};

const finishStoppedTask = async (task: ChatGenerationTask) => {
  task.status = 'stopped';
  task.fullContent = task.fullContent || 'Stopped, safe to go.';
  await saveFinalMessage(task, { isStopped: true });
  emitSnapshot(task, true);
  publishDeepChatNotification({
    id: `generation-stopped-${task.chatId}-${task.assistantMsgId}`,
    type: 'task',
    title: 'Task stopped',
    description: 'The active generation task was stopped.',
    severity: 'warning',
    chatId: task.chatId,
    href: `/chat/${task.chatId}`
  });
};

const finishErroredTask = async (task: ChatGenerationTask, error: unknown) => {
  task.status = 'error';
  const message = getErrorMessage(error) || 'Oops, I fumbled that one. Try tapping it again.';
  await saveFinalMessage(task, { isError: true, errorMessage: message });
  task.fullContent = message;
  emitSnapshot(task, true);
  publishDeepChatNotification({
    id: `generation-error-${task.chatId}-${task.assistantMsgId}`,
    type: 'task',
    title: 'Task failed',
    description: 'The generation task could not be completed.',
    severity: 'error',
    chatId: task.chatId,
    href: `/chat/${task.chatId}`
  });
};

const consumeStream = async (task: ChatGenerationTask, res: Response) => {
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  const provider = res.headers.get('x-provider') || '';

  if (!reader) return;

  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim() || line.startsWith(':')) continue;

      const data = line.replace(/^data:\s*/, '').trim();
      if (data === '[DONE]') break;

      let json: Record<string, unknown>;
      try {
        const parsed = JSON.parse(data) as unknown;
        if (!isRecord(parsed)) continue;
        json = parsed;
      } catch {
        continue;
      }

      if (json.error) {
        throw new Error(getString(json.error) || 'Provider returned an error.');
      }

      if (json.type === 'deepchat_content') {
        task.fullContent += getString(json.text);
        emitSnapshot(task, true);
        continue;
      }

      if (json.type === 'deepchat_clarification') {
        const clarification = isRecord(json.clarification) ? json.clarification as unknown as AgentClarification : undefined;
        if (clarification) {
          task.clarification = clarification;
          task.fullContent = parseAgentClarification(task.fullContent).visibleContent;
          emitSnapshot(task, true);
        }
        continue;
      }

      if (json.type === 'deepchat_reasoning_state') {
        if (typeof json.hasReasoning === 'boolean') {
          task.searchHasReasoning = json.hasReasoning;
          emitSnapshot(task, true);
        }
        continue;
      }

      if (json.type === 'deepchat_search') {
        const nextStatus = json.status === 'searching' ? 'searching' : 'completed';
        const query = getString(json.query) || undefined;
        const count = typeof json.sourceCount === 'number' ? json.sourceCount : undefined;
        task.searchStatus = nextStatus;
        if (typeof json.hasReasoning === 'boolean') {
          task.searchHasReasoning = json.hasReasoning;
        }
        if (nextStatus === 'searching') {
          task.thinkingSteps.push({ type: 'search', query, status: 'searching' });
        } else {
          const lastSearchIdx = [...task.thinkingSteps].reverse().findIndex(s => s.type === 'search');
          if (lastSearchIdx !== -1) {
            const targetIdx = task.thinkingSteps.length - 1 - lastSearchIdx;
            const prev = task.thinkingSteps[targetIdx];
            task.thinkingSteps[targetIdx] = {
              type: 'search',
              query: query ?? (prev.type === 'search' ? prev.query : undefined),
              status: 'completed',
              count: count ?? task.searchSources.length
            };
          } else if ((count ?? task.searchSources.length) > 0) {
            task.thinkingSteps.push({
              type: 'search',
              query,
              status: 'completed',
              count: count ?? task.searchSources.length
            });
          }
        }
        emitSnapshot(task, true);
        continue;
      }

      if (json.type === 'deepchat_sources') {
        task.searchSources = normalizeSearchSources(json.sources);
        if (Array.isArray(json.readSources)) {
          const nextRead = normalizeSearchSources(json.readSources);
          if (nextRead.length > task.readSources.length) {
            const added = nextRead.slice(task.readSources.length);
            const lastStep = task.thinkingSteps[task.thinkingSteps.length - 1];
            if (lastStep && lastStep.type === 'read') {
              lastStep.sources = [...lastStep.sources, ...added];
            } else {
              task.thinkingSteps.push({ type: 'read', sources: added });
            }
          }
          task.readSources = nextRead;
        }
        emitSnapshot(task, true);
        continue;
      }

      if (provider === 'anthropic') {
        const delta = isRecord(json.delta) ? json.delta : null;
        if (json.type === 'content_block_delta') {
          if (task.searchStatus === 'searching') task.searchStatus = 'completed';
          task.fullContent += getString(delta?.text);
        }
      } else if (provider === 'gemini' || provider === 'vertexai') {
        const text = getGeminiText(json);
        if (text && task.searchStatus === 'searching') task.searchStatus = 'completed';
        task.fullContent += text;
      } else {
        const delta = getOpenAiDelta(json);
        if (delta.reasoning) {
          if (task.searchStatus === 'searching') task.searchStatus = 'completed';
          task.fullReasoning += delta.reasoning;
          task.reasoningEndTime = Date.now();
          const lastStep = task.thinkingSteps[task.thinkingSteps.length - 1];
          if (lastStep && lastStep.type === 'thought') {
            lastStep.text += delta.reasoning;
          } else {
            task.thinkingSteps.push({ type: 'thought', text: delta.reasoning });
          }
        }
        if (delta.content) {
          if (task.searchStatus === 'searching') task.searchStatus = 'completed';
          task.fullContent += delta.content;
        }
      }
    }

    emitSnapshot(task);
  }
  if (task.searchStatus === 'searching') {
    task.searchStatus = task.searchSources.length > 0 ? 'completed' : 'idle';
  }
  const parsedContent = parseAgentClarification(task.fullContent);
  task.fullContent = parsedContent.visibleContent;
  if (parsedContent.clarification && !task.clarification) {
    task.clarification = parsedContent.clarification;
    emitSnapshot(task, true);
  }
};

const runTask = async (task: ChatGenerationTask) => {
  try {
    const latestUserMessage = getLatestUserMessage(task.apiMessages);
    const isImageTask = task.generationMode === 'image' || Boolean(task.imageEdit);
    const manualSearch = !isImageTask && latestUserMessage?.webSearchEnabled === true;
    const formattedMessages = formatMessages(task.apiMessages);
    const injectedPrompt = await getInjectedSystemPrompt('', latestUserMessage?.content || '');
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: formattedMessages,
        connectionId: task.connection?.connectionId,
        modelId: task.connection?.id,
        injectedPrompt,
        imageAspectRatio: normalizeImageAspectRatio(latestUserMessage?.imageAspectRatio),
        imageEdit: task.imageEdit,
        manualSearch,
        tools: isImageTask ? [] : getEnabledToolRuntimeItems(true)
      }),
      signal: task.controller.signal
    });

    if (!res.ok) throw new Error(await getResponseError(res));

    await consumeStream(task, res);

    if (task.stopRequested) {
      await finishStoppedTask(task);
    } else {
      await finishSuccessfulTask(task);
    }
  } catch (error: unknown) {
    if (task.stopRequested || isAbortError(error)) {
      await finishStoppedTask(task);
    } else {
      await finishErroredTask(task, error);
    }
  } finally {
    tasks.delete(task.chatId);
    window.dispatchEvent(new CustomEvent('chatUpdated', { detail: { chatId: task.chatId } }));
  }
};

export const startChatGeneration = (
  chatId: string,
  apiMessages: ChatApiMessage[],
  assistantMsgId: string,
  imageEdit?: ImageEditRequestPayload
) => {
  const existing = tasks.get(chatId);
  if (existing) return getSnapshot(existing);
  const selectedConnection = getSelectedConnection();
  const latestUser = getLatestUserMessage(apiMessages);
  const isImageTask = Boolean(imageEdit) || shouldRequestImageGeneration(latestUser);

  const task: ChatGenerationTask = {
    chatId,
    assistantMsgId,
    apiMessages,
    controller: new AbortController(),
    fullContent: '',
    fullReasoning: '',
    displayedContent: '',
    displayedReasoning: '',
    searchStatus: 'idle',
    searchHasReasoning: false,
    searchSources: [],
    readSources: [],
    thinkingSteps: [],
    clarification: undefined,
    startedAt: Date.now(),
    reasoningEndTime: Date.now(),
    status: 'running',
    stopRequested: false,
    connection: selectedConnection,
    generationMode: isImageTask
      ? 'image'
      : getGenerationMode(selectedConnection?.id),
    imageEdit,
    lastEmittedAt: 0,
    pendingEmit: null,
    rafId: null
  };

  tasks.set(chatId, task);
  emitSnapshot(task, true);
  task.promise = runTask(task);
  return getSnapshot(task);
};

export const stopChatGeneration = (chatId: string) => {
  const task = tasks.get(chatId);
  if (!task || task.status !== 'running') return false;
  task.stopRequested = true;
  task.controller.abort();
  return true;
};

export const getChatGenerationState = (chatId: string) => {
  const task = tasks.get(chatId);
  return task ? getSnapshot(task) : null;
};

export const subscribeChatGeneration = (chatId: string, listener: (snapshot: ChatGenerationSnapshot) => void) => {
  const set = listeners.get(chatId) || new Set<(snapshot: ChatGenerationSnapshot) => void>();
  set.add(listener);
  listeners.set(chatId, set);

  const task = tasks.get(chatId);
  if (task) listener(getSnapshot(task));

  return () => {
    const current = listeners.get(chatId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) listeners.delete(chatId);
  };
};
