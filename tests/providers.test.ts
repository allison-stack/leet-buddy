import { describe, it, expect, vi, beforeEach } from 'vitest';
import { groqChat } from '@/llm/providers/groq';
import { RateLimitError } from '@/llm/providers/types';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('groqChat', () => {
  it('POSTs to Groq chat-completions and returns text + token counts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'use a hash map' } }],
          usage: { prompt_tokens: 12, completion_tokens: 4 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await groqChat({
      systemPrompt: 'sys',
      userPrompt: 'usr',
      model: 'llama-3.3-70b-versatile',
      apiKey: 'gsk_x',
    });

    expect(res.text).toBe('use a hash map');
    expect(res.tokensIn).toBe(12);
    expect(res.tokensOut).toBe(4);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer gsk_x' });
  });

  it('throws RateLimitError on 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('rate limit', {
          status: 429,
          headers: { 'Retry-After': '30' },
        })
      )
    );
    await expect(
      groqChat({
        systemPrompt: 's',
        userPrompt: 'u',
        model: 'm',
        apiKey: 'k',
      })
    ).rejects.toBeInstanceOf(RateLimitError);
  });
});
