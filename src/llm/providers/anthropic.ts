import type { ChatFn } from './types';
import { ProviderError, RateLimitError } from './types';

export const anthropicChat: ChatFn = async (req) => {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': req.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: req.model,
      system: req.systemPrompt,
      messages: [{ role: 'user', content: req.userPrompt }],
      max_tokens: req.maxTokens ?? 500,
      temperature: req.temperature ?? 0.4,
    }),
  });

  if (resp.status === 429) throw new RateLimitError();
  if (!resp.ok) throw new ProviderError(`anthropic ${resp.status}: ${await resp.text()}`, resp.status);

  const json = await resp.json() as {
    content: { type: string; text: string }[];
    usage: { input_tokens: number; output_tokens: number };
  };
  const text = json.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return { text, tokensIn: json.usage.input_tokens, tokensOut: json.usage.output_tokens };
};
