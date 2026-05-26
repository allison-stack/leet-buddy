import { TimerManager } from './timer-manager';
import { HintCache } from './hint-cache';
import { RateLimiter } from './rate-limiter';
import { getLocal, setLocal, getSettings } from '@/shared/storage';
import { HINT_CACHE_MAX_ENTRIES } from '@/shared/constants';
import { chat, type ProviderConfig } from '@/llm';

export interface WorkerState {
  timers: TimerManager;
  cache: HintCache;
  limiter: RateLimiter;
}

let cached: WorkerState | null = null;

export async function getState(): Promise<WorkerState> {
  if (cached) return cached;

  const settings = await getSettings();
  const timerJson = await getLocal<Array<[number, unknown]>>('timer_state');
  const cacheJson = await getLocal<{ key: string; value: string }[]>('hint_cache');

  cached = {
    timers: timerJson ? TimerManager.fromJSON(timerJson as Parameters<typeof TimerManager.fromJSON>[0]) : new TimerManager(),
    cache: cacheJson ? HintCache.fromJSON(cacheJson, HINT_CACHE_MAX_ENTRIES) : new HintCache(HINT_CACHE_MAX_ENTRIES),
    limiter: new RateLimiter(settings.hourlyRequestCap, 60 * 60 * 1000),
  };
  return cached;
}

export async function persistTimers(state: WorkerState): Promise<void> {
  await setLocal('timer_state', state.timers.toJSON());
}

export async function persistCache(state: WorkerState): Promise<void> {
  await setLocal('hint_cache', state.cache.toJSON());
}

export async function buildProviderConfigs(): Promise<{ primary: ProviderConfig; fallback?: ProviderConfig }> {
  const settings = await getSettings();
  const primaryKey = settings.llm.keyStorage === 'sync'
    ? settings.apiKey
    : await getLocal<string>('api_key');
  if (!primaryKey) throw new Error('No API key configured. Open Leet Buddy settings.');

  const primary: ProviderConfig = {
    provider: settings.llm.provider,
    model: settings.llm.model,
    apiKey: primaryKey,
  };

  let fallback: ProviderConfig | undefined;
  if (settings.llm.fallbackProvider && settings.llm.fallbackModel) {
    const fbKey = settings.fallbackApiKey
      ?? (settings.llm.keyStorage === 'local' ? await getLocal<string>('fallback_api_key') : undefined);
    if (fbKey) {
      fallback = { provider: settings.llm.fallbackProvider, model: settings.llm.fallbackModel, apiKey: fbKey };
    }
  }
  return { primary, fallback };
}

export { chat };
