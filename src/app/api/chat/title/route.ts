import { NextResponse } from 'next/server';
import { getLiveLiteConnection, getLiveChatConnection } from '@/lib/ai/live';

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

type TitleModelResponse = {
  choices?: { message?: { content?: string } }[];
};

export async function POST(req: Request) {
  let promptForFallback = '';
  try {
    const { prompt, modelId } = await req.json() as {
      prompt?: string;
      modelId?: string;
      connectionId?: string;
    };
    promptForFallback = prompt || '';

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const conn = getLiveLiteConnection() || getLiveChatConnection();
    if (!conn) {
      return NextResponse.json({ title: buildFallbackTitle(promptForFallback) });
    }

    const sysMsg = "Create a specific chat title from the user's message. Output only a concise 3-6 word title. Never output New Chat, Untitled Chat, Chat Title, quotes, markdown, or explanations.";

    const url = `${conn.baseUrl}/v1/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${conn.apiKey}`
      },
      body: JSON.stringify({
        model: conn.model || modelId || 'gpt-4o-mini',
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

    if (res.ok) {
      const data = await res.json() as TitleModelResponse;
      const rawTitle = data.choices?.[0]?.message?.content || '';
      const title = cleanTitle(rawTitle);
      if (title && !isGenericTitle(title)) {
        return NextResponse.json({ title });
      }
    }

    return NextResponse.json({ title: buildFallbackTitle(promptForFallback) });
  } catch {
    return NextResponse.json({ title: buildFallbackTitle(promptForFallback) });
  }
}
