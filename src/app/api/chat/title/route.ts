import { NextResponse } from 'next/server';
import { getLiveLiteConnection, getLiveChatConnection } from '@/lib/ai/live';
import { isAiLogEnabled } from '@/lib/ai/ai-logs';
import { MAX_TITLE_PROMPT_CHARS } from '@/lib/security/limits';
import { estimateTokens } from '@/lib/security/usage-meter';
import { checkUsageBudget, recordTokens } from '@/lib/security/usage';
import { getClientIp } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

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
  const words = clean.split(' ').filter(word => word.length > 1).slice(0, 6);
  const title = words.join(' ');
  return title || 'Untitled Conversation';
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

  // Reject verbatim or prefix echoes of short user messages so AI retries/summarizes instead
  const normTitle = normalizeForCompare(title);
  const normPrompt = normalizeForCompare(sourcePrompt);
  if (normPrompt && normTitle) {
    if (normTitle === normPrompt) return true;
    const promptWords = normPrompt.split(' ');
    if (promptWords.length <= 8 && (normPrompt.startsWith(normTitle) || normTitle.startsWith(normPrompt))) {
      return true;
    }
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

const TITLE_SYSTEM_PROMPT = [
  'You are a chat title generator. Summarize the topic or intent of the user message into a natural 3-6 word noun-phrase title in the same language as the message.',
  'Never copy, repeat, or echo the user message verbatim, even for very short greetings or brief questions.',
  'Output only the title. Never output New Chat, Untitled Chat, Chat Title, quotes, markdown, or explanations.'
].join(' ');

async function requestAiTitle(
  conn: { baseUrl: string; apiKey: string; model: string },
  prompt: string,
  temperature: number,
  clientIp: string
): Promise<{ title?: string; status?: number }> {
  try {
    const url = `${conn.baseUrl}/v1/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${conn.apiKey}`
      },
      body: JSON.stringify({
        model: conn.model,
        messages: [
          { role: 'system', content: TITLE_SYSTEM_PROMPT },
          { role: 'user', content: `Summarize into a 3-6 word topic title (do not copy verbatim):\n"""\n${prompt}\n"""` }
        ],
        stream: false,
        max_tokens: 512,
        temperature
      }),
      signal: AbortSignal.timeout(12000)
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
      return { status: res.status };
    }

    const data = await res.json() as TitleModelResponse;
    const rawTitle = data.choices?.[0]?.message?.content || '';
    const title = cleanTitle(rawTitle);
    recordTokens(
      clientIp,
      estimateTokens(TITLE_SYSTEM_PROMPT) + estimateTokens(prompt) + estimateTokens(rawTitle)
    );
    return { title };
  } catch {
    return {};
  }
}

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

    const liteConn = getLiveLiteConnection();
    const chatConn = getLiveChatConnection();
    const primaryConn = (liteConn?.model ? liteConn : null) || (chatConn?.model ? chatConn : null);

    if (!primaryConn) {
      return NextResponse.json({ title: buildFallbackTitle(promptForFallback) });
    }

    const clientIp = getClientIp(req).slice(0, 128);
    // budget gate, a blocked identity degrades to the local
    // fallback title instead of a provider call
    if (!checkUsageBudget(clientIp).allowed) {
      return NextResponse.json({ title: buildFallbackTitle(promptForFallback) });
    }

    const first = await requestAiTitle(primaryConn, prompt, 0.4, clientIp);
    if (first.title && !isGenericTitle(first.title, prompt)) {
      return NextResponse.json({ title: first.title });
    }

    // If primary (e.g. LITE) failed or echoed verbatim, try chat connection or retry with higher temperature
    const secondaryConn =
      chatConn?.model && (chatConn.baseUrl !== primaryConn.baseUrl || chatConn.model !== primaryConn.model)
        ? chatConn
        : primaryConn;
    const second = await requestAiTitle(secondaryConn, prompt, 0.7, clientIp);
    if (second.title && !isGenericTitle(second.title, prompt)) {
      return NextResponse.json({ title: second.title });
    }

    if (first.status && (!second.status || second.status >= 400)) {
      return upstreamTitleError(second.status || first.status);
    }

    return NextResponse.json({ title: buildFallbackTitle(promptForFallback) });
  } catch {
    return NextResponse.json({ title: buildFallbackTitle(promptForFallback) });
  }
}
