import type { ChatFn } from './types';
import { ProviderError, RateLimitError } from './types';

export const openaiChat: ChatFn = async (req) => {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model: req.model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
      temperature: req.temperature ?? 0.4,
      max_tokens: req.maxTokens ?? 500,
    }),
  });

  if (resp.status === 429) throw new RateLimitError();
  if (!resp.ok) throw new ProviderError(`openai ${resp.status}: ${await resp.text()}`, resp.status);

  const json = await resp.json() as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens: number; completion_tokens: number };
  };
  return {
    text: json.choices[0]?.message?.content ?? '',
    tokensIn: json.usage?.prompt_tokens ?? 0,
    tokensOut: json.usage?.completion_tokens ?? 0,
  };
};
