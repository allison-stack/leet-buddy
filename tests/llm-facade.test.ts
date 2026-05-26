import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chat } from '@/llm';
import { RateLimitError, type ChatFn } from '@/llm/providers/types';

const ok: ChatFn = vi.fn().mockResolvedValue({ text: 'ok', tokensIn: 1, tokensOut: 1 });
const ratelimited: ChatFn = vi.fn().mockRejectedValue(new RateLimitError());

beforeEach(() => { vi.clearAllMocks(); });

describe('chat facade', () => {
  it('routes to primary provider', async () => {
    const res = await chat({
      systemPrompt: 's', userPrompt: 'u',
      primary: { provider: 'groq', model: 'm', apiKey: 'k', chatFn: ok },
    });
    expect(res.text).toBe('ok');
    expect(ok).toHaveBeenCalledOnce();
  });

  it('falls back to secondary on rate limit', async () => {
    const res = await chat({
      systemPrompt: 's', userPrompt: 'u',
      primary: { provider: 'groq', model: 'm', apiKey: 'k', chatFn: ratelimited },
      fallback: { provider: 'gemini', model: 'g', apiKey: 'k2', chatFn: ok },
    });
    expect(res.text).toBe('ok');
    expect(ratelimited).toHaveBeenCalledOnce();
    expect(ok).toHaveBeenCalledOnce();
  });

  it('rethrows when no fallback configured', async () => {
    await expect(chat({
      systemPrompt: 's', userPrompt: 'u',
      primary: { provider: 'groq', model: 'm', apiKey: 'k', chatFn: ratelimited },
    })).rejects.toBeInstanceOf(RateLimitError);
  });
});
