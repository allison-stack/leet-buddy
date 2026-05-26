export interface ChatRequest {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

export class RateLimitError extends Error {
  constructor(public retryAfterMs?: number) {
    super('rate limited');
  }
}

export class ProviderError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export type ChatFn = (req: ChatRequest) => Promise<ChatResponse>;
