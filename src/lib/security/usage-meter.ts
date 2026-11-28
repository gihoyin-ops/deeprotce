import { recordTokens } from './usage';

// rough token math: text is chars / 4, images cost 850 flat
// if the provider sends a real usage object, that overrides this guesswork

const IMAGE_PART_TOKENS = 850;

const decoder = new TextDecoder();

export const estimateTokens = (text: string): number =>
  text ? Math.max(1, Math.ceil(text.length / 4)) : 0;

const responseAsObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : null;

/** grab real provider usage from the JSON response if it exists */
export const providerUsageTokens = (data: unknown): number | null => {
  const usage = responseAsObject((responseAsObject(data)?.usage as unknown) ?? null);
  if (!usage) return null;
  const total = asNumber(usage.total_tokens);
  if (total !== null) return total;
  const prompt = asNumber(usage.prompt_tokens);
  const completion = asNumber(usage.completion_tokens);
  if (prompt !== null || completion !== null) return (prompt ?? 0) + (completion ?? 0);
  return null;
};

/** estimate prompt tokens from the final upstream message array */
export const estimateChatPromptTokens = (messages: { role?: string; content?: unknown }[]): number => {
  let textChars = 0;
  let imageParts = 0;
  for (const message of messages) {
    if (typeof message?.content === 'string') {
      textChars += message.content.length;
    } else if (Array.isArray(message?.content)) {
      for (const part of message.content) {
        const p = responseAsObject(part);
        if (!p) continue;
        if (typeof p.text === 'string') textChars += p.text.length;
        else if (p.type === 'image_url') imageParts += 1;
      }
    }
  }
  return Math.ceil(textChars / 4) + imageParts * IMAGE_PART_TOKENS;
};

/** total tokens for a non-stream chat turn, provider count wins if present */
export const completeChatTokens = (data: unknown, promptTokens: number, completionText: string): number => {
  const provider = providerUsageTokens(data);
  if (provider !== null) return provider;
  return promptTokens + estimateTokens(completionText);
};

/** tracks token usage across a provider SSE stream */
export class SseUsageMeter {
  private buffer = '';
  private textChars = 0;
  private providerTokens: number | null = null;

  ingest(chunk: Uint8Array): void {
    this.buffer += decoder.decode(chunk, { stream: true });
    // cap the buffer so a missing newline doesn't OOM the process
    if (this.buffer.length > 1_000_000 && !this.buffer.includes('\n')) this.buffer = this.buffer.slice(-65_536);
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).replace(/\r$/, '');
      this.buffer = this.buffer.slice(newlineIndex + 1);
      this.ingestLine(line);
    }
  }

  private ingestLine(line: string): void {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    let json: Record<string, unknown>;
    try {
      json = responseAsObject(JSON.parse(data)) ?? {};
    } catch {
      return;
    }
    const choices = Array.isArray(json.choices) ? json.choices : [];
    const choice = responseAsObject(choices[0] ?? null);
    const delta = responseAsObject(choice?.delta ?? null);
    for (const key of ['content', 'reasoning_content'] as const) {
      if (typeof delta?.[key] === 'string') this.textChars += (delta[key] as string).length;
    }
    if (this.providerTokens === null) {
      this.providerTokens = providerUsageTokens(json);
    }
  }

  /** return provider usage if we saw it, otherwise fall back to char math */
  tokens(promptTokens: number): number {
    if (this.providerTokens !== null) return this.providerTokens;
    return Math.ceil(this.textChars / 4) + promptTokens;
  }
}

/** proxies the SSE stream and logs token spend once on end or cancel */
export const meterSseBody = (
  body: ReadableStream<Uint8Array> | null,
  identityKey: string,
  promptTokens: number,
  onSettled?: (totalTokens: number) => void
): ReadableStream<Uint8Array> | null => {
  if (!body) return null;
  const meter = new SseUsageMeter();
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    const totalTokens = meter.tokens(promptTokens);
    recordTokens(identityKey, totalTokens);
    onSettled?.(totalTokens);
  };
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  // settle on every exit path, otherwise cancelling mid-stream would bill zero
  return new ReadableStream<Uint8Array>({
    start(controller) {
      reader = body.getReader();
      void (async () => {
        try {
          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            meter.ingest(value);
            controller.enqueue(value);
          }
        } catch {
          // upstream blew up or client bailed, kill the pump
        } finally {
          settle();
          try {
            controller.close();
          } catch {
            // stream already closed or errored
          }
        }
      })();
    },
    cancel() {
      settle();
      if (reader) {
        void reader.cancel().catch(() => undefined);
      }
    }
  });
};
