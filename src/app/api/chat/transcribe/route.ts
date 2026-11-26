import { NextResponse } from 'next/server';
import {
  buildRelayHeaders,
  getAiRelayConfig,
  getLiveChatConnection,
  getLiveLiteConnection,
  relayErrorResponse,
  resolveRelayClientId,
} from '@/lib/ai/live';

export const runtime = 'nodejs';

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

function resolveAudioFormat(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('wav')) return 'wav';
  if (lower.includes('mp3') || lower.includes('mpeg')) return 'mp3';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('mp4') || lower.includes('m4a')) return 'mp4';
  return 'webm';
}

export async function POST(req: Request) {
  const relay = getAiRelayConfig();
  if (!relay) {
    return NextResponse.json(
      { error: 'Transcription service is not configured.' },
      { status: 503 }
    );
  }

  try {
    const form = await req.formData();
    const audio = form.get('audio');
    const lang = typeof form.get('lang') === 'string' ? String(form.get('lang')).trim() : '';

    if (!(audio instanceof Blob) || audio.size <= 0) {
      return NextResponse.json({ error: 'Missing audio recording.' }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio recording is too large.' }, { status: 413 });
    }

    const clientId = resolveRelayClientId(req);
    const mimeType = audio.type || 'audio/webm';
    const ext = resolveAudioFormat(mimeType);
    const langShort = lang ? lang.split('-')[0] : '';

    // 1. Hit the OpenAI-compatible Whisper endpoint first
    const upstreamForm = new FormData();
    upstreamForm.append('file', audio, `dictation.${ext}`);
    upstreamForm.append('model', 'whisper-1');
    if (langShort) {
      upstreamForm.append('language', langShort);
    }

    const whisperRes = await fetch(`${relay.baseUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      headers: buildRelayHeaders({
        clientSecret: relay.clientSecret,
        clientId,
      }),
      body: upstreamForm,
      signal: req.signal,
    });

    if (whisperRes.ok) {
      const data = (await whisperRes.json().catch(() => ({}))) as { text?: string };
      return NextResponse.json({ ok: true, text: (data.text || '').trim() });
    }

    // 2. Whisper endpoint is missing or busted, fall back to multimodal chat completions with input_audio
    if (whisperRes.status === 404 || whisperRes.status === 405 || whisperRes.status === 501) {
      const liveConn = getLiveLiteConnection() || getLiveChatConnection();
      if (!liveConn?.model) {
        return relayErrorResponse(whisperRes.status, whisperRes.headers);
      }
      const bytes = Buffer.from(await audio.arrayBuffer()).toString('base64');
      const chatRes = await fetch(`${relay.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: buildRelayHeaders({
          clientSecret: relay.clientSecret,
          clientId,
          contentType: 'application/json',
        }),
        signal: req.signal,
        body: JSON.stringify({
          model: liveConn.model,
          stream: false,
          messages: [
            {
              role: 'system',
              content:
                'Transcribe the spoken audio verbatim. Return ONLY the transcribed text without quotes, labels, or commentary.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'input_audio',
                  input_audio: {
                    data: bytes,
                    format: ext === 'mp4' ? 'm4a' : ext,
                  },
                },
              ],
            },
          ],
        }),
      });

      if (!chatRes.ok) {
        return relayErrorResponse(chatRes.status, chatRes.headers);
      }

      const chatJson = (await chatRes.json().catch(() => ({}))) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = (chatJson.choices?.[0]?.message?.content || '').trim();
      return NextResponse.json({ ok: true, text });
    }

    return relayErrorResponse(whisperRes.status, whisperRes.headers);
  } catch (err) {
    if (req.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
      return new Response(null, { status: 499 });
    }
    return NextResponse.json(
      { error: 'Could not transcribe audio right now.' },
      { status: 500 }
    );
  }
}
