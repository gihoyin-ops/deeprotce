import { NextResponse } from 'next/server';
import { getPersona } from '@/app/persona';
import { getLiveLiteConnection } from '@/lib/ai/live';
import { recordChatHistoryMemory, saveExtractedMemories, type SavedMemory } from '@/app/memory';

export const runtime = 'nodejs';
export const maxDuration = 15;

const systemPrompt = `You extract durable user memories for DeepChat. Return a compact JSON array only. Each item must be {"content":"...","category":"...","importance":"low|medium|high"}. Save only explicit or strongly implied stable facts about the user: identity, preferred name, language preference stated by the user, role, durable preferences, long-term goals, recurring projects, constraints, and standing instructions. Do not infer preferences from a single greeting, language used once, assistant style, repeated regenerate outputs, short chit-chat, temporary requests, secrets, API keys, passwords, payment data, medical/legal/financial details, sensitive traits, facts about the assistant, insults, jokes, or anything uncertain. If there is nothing useful to remember, return [].`;

interface ExtractedMemoryCandidate {
  content?: unknown;
  category?: unknown;
  importance?: unknown;
}

interface NormalizedExtractedMemory {
  content: string;
  category: string;
  importance: 'low' | 'medium' | 'high';
}

const parseJsonArray = (text: string) => {
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) return [];
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
};

const buildPrompt = (userMessage: string, assistantMessage: string) => `Latest user message:
${userMessage.slice(0, 5000)}

Assistant response:
${assistantMessage.slice(0, 3000)}

Extract only durable user memories from the user message and useful context confirmed by the assistant response.`;

const durableSignalPatterns = [
  /\b(?:ingat|remember|catat|save)\b/i,
  /\b(?:nama saya|nama aku|nama gue|nama gua|nama gw|namaku|my name is|call me|panggil saya|panggil aku|panggil gue|panggil gua|panggil gw)\b/i,
  /\b(?:saya|aku|gue|gua|gw|i)\s+(?:suka|prefer|preferensi|biasanya|selalu|sering|bekerja|kerja|membangun|punya|pakai|menggunakan)\b/i,
  /\b(?:jangan|don't|do not|always|selalu)\s+(?:panggil|gunakan|jawab|pakai|use|answer|call)\b/i,
  /\b(?:pekerjaan|profesi|role|project|proyek|goal|tujuan|constraint|batasan|preference|preferensi)\b/i
];

const isExplicitMemoryIntent = (text: string) => durableSignalPatterns.slice(0, 2).some(pattern => pattern.test(text));

const hasDurableSignal = (text: string) => durableSignalPatterns.some(pattern => pattern.test(text));

const getSignalWordCount = (text: string) => text
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter(token => token.length > 2)
  .length;

const shouldRunSavedMemoryExtraction = (userMessage: string) => {
  const normalized = userMessage.replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  if (isExplicitMemoryIntent(normalized)) return true;
  if (!hasDurableSignal(normalized)) return false;
  return normalized.length >= 24 && getSignalWordCount(normalized) >= 5;
};

const isUsefulMemoryCandidate = (item: NormalizedExtractedMemory, userMessage: string) => {
  const content = item.content.replace(/\s+/g, ' ').trim();
  if (content.length < 8 || content.length > 260) return false;
  const lower = content.toLowerCase();
  const userLower = userMessage.toLowerCase();
  if (/\b(?:assistant|deepchat|model|ai)\b/.test(lower)) return false;
  if (/\b(?:halo|hello|hi|hey)\b[!. ]*$/.test(userLower) && !isExplicitMemoryIntent(userMessage)) return false;
  if (lower.includes('prefers communicating in indonesian') && !/(indonesia|bahasa)/i.test(userMessage)) return false;
  if (!isExplicitMemoryIntent(userMessage) && !hasDurableSignal(userMessage) && item.importance !== 'high') return false;
  return true;
};

const extractExplicitMemoryFallback = (userMessage: string) => {
  const text = userMessage.replace(/\s+/g, ' ').trim();
  const patterns = [
    /\b(?:ingat|remember)\s+(?:bahwa|that)\s+(.+)/i,
    /\b(?:tolong\s+)?(?:ingat|remember)\s+(.+)/i,
    /\b(?:catat|save)\s+(?:bahwa|that)?\s*(.+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const raw = match?.[1]?.trim().replace(/[.!?]+$/, '');
    if (!raw || raw.length < 6 || raw.length > 220) continue;
    return [{
      content: raw,
      category: 'User Preference',
      importance: 'high' as const
    }];
  }

  return [];
};

const callMemoryModel = async (conn: { baseUrl: string; apiKey: string; model?: string }, model: string, prompt: string) => {
  const url = `${conn.baseUrl}/v1/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${conn.apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    }),
    signal: AbortSignal.timeout(4000)
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data?.choices?.[0]?.message?.content || '';
};

export async function POST(req: Request) {
  try {
    const { userMessage, assistantMessage, modelId, chatId, userMessageId } = await req.json();

    // Fast pre-filter: return immediately without any DB or network calls
    if (!userMessage || typeof userMessage !== 'string' || !hasDurableSignal(userMessage) || !shouldRunSavedMemoryExtraction(userMessage)) {
      return NextResponse.json({ savedCount: 0, memories: [] });
    }

    const persona = await getPersona();

    if (persona.memoryReferenceSaved === false && persona.memoryReferenceHistory === false) {
      return NextResponse.json({ savedCount: 0, memories: [] });
    }

    if (!assistantMessage) {
      return NextResponse.json({ savedCount: 0, memories: [] });
    }

    const conn = getLiveLiteConnection();
    if (!conn) {
      return NextResponse.json({ savedCount: 0, memories: [] });
    }

    const model = modelId || conn.model || 'gpt-4o-mini';
    const metadata = {
      provider: conn.provider,
      model,
      connectionId: conn.id,
      chatId,
      userMessageId
    };

    let saved: SavedMemory[] = [];
    if (persona.memoryReferenceSaved !== false) {
      let extracted: NormalizedExtractedMemory[] = [];
      try {
        const raw = await callMemoryModel(conn, model, buildPrompt(userMessage, assistantMessage));
        extracted = parseJsonArray(raw)
          .map((item: ExtractedMemoryCandidate) => {
            const importance: 'low' | 'medium' | 'high' =
              item?.importance === 'low' || item?.importance === 'medium' || item?.importance === 'high'
                ? item.importance
                : 'medium';
            return {
              content: typeof item?.content === 'string' ? item.content : '',
              category: typeof item?.category === 'string' ? item.category : 'General',
              importance
            };
          })
          .filter(item => isUsefulMemoryCandidate(item, userMessage));
      } catch {
        extracted = [];
      }

      if (extracted.length === 0) {
        extracted = extractExplicitMemoryFallback(userMessage);
      }

      extracted = extracted.filter(item => isUsefulMemoryCandidate(item, userMessage));
      saved = await saveExtractedMemories(extracted, metadata);
    }

    const historySaved = persona.memoryReferenceHistory === false
      ? null
      : await recordChatHistoryMemory(userMessage, assistantMessage, metadata);

    return NextResponse.json({
      savedCount: saved.length,
      savedMemoryCount: saved.length,
      memories: saved,
      historySaved: Boolean(historySaved),
      provider: conn.provider,
      model
    });
  } catch {
    return NextResponse.json({ savedCount: 0, memories: [] });
  }
}
