import { NextResponse } from 'next/server';
import { getLiveLiteConnection, getLiveChatConnection } from '@/lib/ai/live';
import { isAiLogEnabled } from '@/lib/ai/ai-logs';
import { MAX_TITLE_PROMPT_CHARS } from '@/lib/security/limits';
import { estimateTokens } from '@/lib/security/usage-meter';
import { checkUsageBudget, recordTokens } from '@/lib/security/usage';
import { getClientIp } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 15;

const ID_GREETING_PATTERN = /^(halo+|hai+|permisi|assalamualaikum|selamat\s+(pagi|siang|sore|malam)|pagi|siang|sore|malam|tes+|oke+|ok)$/i;
const EN_GREETING_PATTERN = /^(hi+|hello+|hey+|yo+|test+|testing|ping|sup|good\s+(morning|afternoon|evening))$/i;

const normalizeForCompare = (text: string) =>
  text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const buildFallbackTitle = (prompt: string) => {
  const clean = prompt
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (ID_GREETING_PATTERN.test(clean)) return 'Sapaan dan Percakapan Awal';
  if (EN_GREETING_PATTERN.test(clean)) return 'Greeting and Initial Chat';

  const words = clean.split(' ').filter(word => word.length > 1).slice(0, 6);
  if (words.length <= 1 && clean.length <= 12) {
    return 'Percakapan Baru';
  }
  const title = words.join(' ');
  return title || 'Percakapan Baru';
};

const isGenericTitle = (title: string, sourcePrompt = '') => {
  const normalized = title.replace(/["'*.]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (
    !normalized ||
    normalized === 'new chat' ||
    normalized === 'untitled chat' ||
    normalized === 'untitled conversation' ||
    normalized === 'chat title' ||
    normalized === 'conversation title' ||
    normalized.length < 4
  ) {
    return true;
  }

  // Reject verbatim echo of short prompts (e.g. "Halo" -> "Halo")
  const normTitle = normalizeForCompare(title);
  const normPrompt = normalizeForCompare(sourcePrompt);
  if (normPrompt && normTitle === normPrompt && normPrompt.split(' ').length <= 2) {
    return true;
  }

  return false;
};

const cleanTitle = (raw: string) => raw
  .replace(/```[\s\S]*?```/g, '')
  .replace(/^title\s*:\s*/i, '')
  .replace(/^["'*\s]+|["'*\s]+$/g, '')
  .replace(/[.!?]+$/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .split(' ')
  .slice(0, 7)
  .join(' ');

// upstream body text must never reach the client; map status classes to sanitized constants
const upstreamTitleError = (status: number) => {
  if (status === 401 || status === 403) {
    return NextResponse.json({ error: 'upstream auth error' }, { status: 400 });
  }
  if (status === 408 || status === 429) {
    return NextResponse.json({ error: 'upstream busy' }, { status: 503 });
  }
  return NextResponse.json({ error: 'upstream error', status }, { status: 502 });
};

type TitleModelResponse = {
  choices?: { message?: { content?: string } }[];
};

export async function POST(req: Request) {
  let promptForFallback = '';
  try {
    const body = await req.json() as {
      prompt?: string;
      connectionId?: string;
    };
    // client sends raw chat text; hard cap prompt size for the LLM call
    const prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, MAX_TITLE_PROMPT_CHARS) : '';
    promptForFallback = prompt || '';

    if (!prompt) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const conn = getLiveLiteConnection() || getLiveChatConnection();
    if (!conn) {
      return NextResponse.json({ title: buildFallbackTitle(promptForFallback) });
    }

    // budget gate, a blocked identity degrades to the local
    // fallback title instead of a provider call
    if (!checkUsageBudget(getClientIp(req).slice(0, 128)).allowed) {
      return NextResponse.json({ title: buildFallbackTitle(promptForFallback) });
    }

    const sysMsg = [
      'Generate a concise, descriptive 3-6 word title summarizing the topic or intent of the user message, in the same language as the message.',
      'Never repeat or copy the user message verbatim, especially for short greetings or single-word inputs like "Halo", "Hi", "Test", or "Ok".',
      'For a greeting or short opener, describe the interaction instead (e.g. "Sapaan dan Percakapan Awal" or "Greeting and Initial Chat").',
      'Output only the title. Never output New Chat, Untitled Chat, Chat Title, quotes, markdown, or explanations.'
    ].join(' ');

    if (!conn.model) {
      return NextResponse.json({ title: buildFallbackTitle(promptForFallback) });
    }

    const url = `${conn.baseUrl}/v1/chat/completions`;
    // server env model only; a client-supplied modelId could target arbitrary provider models
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${conn.apiKey}`
      },
      body: JSON.stringify({
        model: conn.model,
        messages: [
          { role: 'system', content: sysMsg },
          { role: 'user', content: `Message:\n"""\n${prompt}\n"""` }
        ],
        stream: false,
        max_tokens: 30,
        temperature: 0.3
      }),
      signal: AbortSignal.timeout(3500)
    });

    if (!res.ok) {
      let upstreamBody = '';
      try {
        upstreamBody = await res.text();
      } catch {
      }
      if (isAiLogEnabled()) {
        console.error(`[chat-title] upstream ${res.status}: ${upstreamBody.slice(0, 2000)}`);
      }
      return upstreamTitleError(res.status);
    }

    const data = await res.json() as TitleModelResponse;
    const rawTitle = data.choices?.[0]?.message?.content || '';
    const title = cleanTitle(rawTitle);
    // LITE model, same budget, output capped at 30 tokens
    recordTokens(getClientIp(req).slice(0, 128), estimateTokens(sysMsg) + estimateTokens(prompt) + estimateTokens(rawTitle));
    if (title && !isGenericTitle(title, prompt)) {
      return NextResponse.json({ title });
    }

    return NextResponse.json({ title: buildFallbackTitle(promptForFallback) });
  } catch {
    return NextResponse.json({ title: buildFallbackTitle(promptForFallback) });
  }
}
