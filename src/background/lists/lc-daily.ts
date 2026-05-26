import { getLocal, setLocal } from '@/shared/storage';
import { LC_DAILY_CACHE_TTL_MS } from '@/shared/constants';

interface CachedDaily { slug: string; fetchedAt: number }

const GRAPHQL = 'https://leetcode.com/graphql';
const QUERY = `query questionOfToday {
  activeDailyCodingChallengeQuestion {
    question { titleSlug }
  }
}`;

export async function getDailySlug(now: number = Date.now()): Promise<string | null> {
  const cached = await getLocal<CachedDaily>('lc_daily_cache');
  if (cached && now - cached.fetchedAt < LC_DAILY_CACHE_TTL_MS) return cached.slug;

  try {
    const resp = await fetch(GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: QUERY }),
    });
    if (!resp.ok) throw new Error(`lc daily ${resp.status}`);
    const json = await resp.json() as { data?: { activeDailyCodingChallengeQuestion?: { question?: { titleSlug?: string } } } };
    const slug = json.data?.activeDailyCodingChallengeQuestion?.question?.titleSlug;
    if (!slug) throw new Error('no slug in response');
    await setLocal('lc_daily_cache', { slug, fetchedAt: now });
    return slug;
  } catch {
    return cached?.slug ?? null;
  }
}
