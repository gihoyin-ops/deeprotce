import { NextResponse } from 'next/server';
import { getLiveLiteConnection, getLiveChatConnection } from '@/lib/ai/live';
import { isAiLogEnabled } from '@/lib/ai/ai-logs';
import { MAX_TITLE_PROMPT_CHARS } from '@/lib/security/limits';
import { estimateTokens } from '@/lib/security/usage-meter';
import { checkUsageBudget, recordTokens } from '@/lib/security/usage';
import { getClientIp } from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 15;

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

const isGenericTitle = (title: string) => {
  const normalized = title.replace(/["'*.]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  return !normalized ||
    normalized === 'new chat' ||
    normalized === 'untitled chat' ||
    normalized === 'untitled conversation' ||
    normalized === 'chat title' ||
    normalized === 'conversation title' ||
    normalized.length < 4;
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

    const sysMsg = "Create a specific chat title from the user's message. Output only a concise 3-6 word title. Never output New Chat, Untitled Chat, Chat Title, quotes, markdown, or explanations.";

    const url = `${conn.baseUrl}/v1/chat/completions`;
    // server env model only; a client-supplied modelId could target arbitrary provider models
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${conn.apiKey}`
      },
      body: JSON.stringify({
        model: conn.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sysMsg },
          { role: 'user', content: prompt }
        ],
        stream: false,
        max_tokens: 30,
        temperature: 0.2
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
    if (title && !isGenericTitle(title)) {
      return NextResponse.json({ title });
    }

    return NextResponse.json({ title: buildFallbackTitle(promptForFallback) });
  } catch {
    return NextResponse.json({ title: buildFallbackTitle(promptForFallback) });
  }
}
