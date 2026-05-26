import type { LlmProvider } from '@/shared/types';
import { groqChat } from './providers/groq';
import { geminiChat } from './providers/gemini';
import { anthropicChat } from './providers/anthropic';
import { openaiChat } from './providers/openai';
import type { ChatFn, ChatResponse } from './providers/types';
import { ProviderError, RateLimitError } from './providers/types';

export const PROVIDERS: Record<LlmProvider, ChatFn> = {
  groq: groqChat,
  gemini: geminiChat,
  anthropic: anthropicChat,
  openai: openaiChat,
};

export interface ProviderConfig {
  provider: LlmProvider;
  model: string;
  apiKey: string;
  chatFn?: ChatFn; // injectable for tests
}

export interface ChatArgs {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  primary: ProviderConfig;
  fallback?: ProviderConfig;
}

async function callOnce(cfg: ProviderConfig, args: Omit<ChatArgs, 'primary' | 'fallback'>): Promise<ChatResponse> {
  const fn = cfg.chatFn ?? PROVIDERS[cfg.provider];
  return fn({
    systemPrompt: args.systemPrompt,
    userPrompt: args.userPrompt,
    model: cfg.model,
    apiKey: cfg.apiKey,
    temperature: args.temperature,
    maxTokens: args.maxTokens,
  });
}

export async function chat(args: ChatArgs): Promise<ChatResponse> {
  try {
    return await callOnce(args.primary, args);
  } catch (err) {
    const shouldFallback =
      args.fallback && (err instanceof RateLimitError || (err instanceof ProviderError && err.status !== undefined && err.status >= 500));
    if (!shouldFallback) throw err;
    return callOnce(args.fallback!, args);
  }
}
