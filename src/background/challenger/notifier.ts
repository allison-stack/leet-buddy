import type { Challenge } from '@/shared/types';

export interface NotifierStorage {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface NotifierLike {
  tick(pending: Challenge[], recent: Challenge[], meId: string): Promise<void>;
}

export class Notifier implements NotifierLike {
  constructor(private storage: NotifierStorage) {}

  async tick(pending: Challenge[], recent: Challenge[], meId: string): Promise<void> {
    const stored = await this.storage.get(['notified_challenge_ids', 'notif_nav_map']);
    const notifiedIds = (stored['notified_challenge_ids'] as string[] | undefined) ?? [];
    const navMap = (stored['notif_nav_map'] as Record<string, string> | undefined) ?? {};

    for (const c of pending) {
      if (notifiedIds.includes(c.id)) continue;
      const notifId = `challenger_${c.id}`;
      chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: '/icons/48.png',
        title: '⚔️ Challenge incoming',
        message: c.problem_title,
        buttons: [{ title: 'Go to problem →' }],
      });
      navMap[notifId] = c.problem_slug;
      notifiedIds.push(c.id);
    }

    for (const c of recent) {
      const isExpired = c.state === 'expired_forfeit' || c.state === 'expired_no_contest';
      if (c.state !== 'completed' && !isExpired) continue;
      if (notifiedIds.includes(c.id)) continue;
      const title = isExpired
        ? '⏰ Challenge expired'
        : c.winner_id === meId ? '🏆 You won!' : '😔 You lost';
      const notifId = `challenger_result_${c.id}`;
      chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: '/icons/48.png',
        title,
        message: c.problem_title,
        buttons: [{ title: 'Go to problem →' }],
      });
      navMap[notifId] = c.problem_slug;
      notifiedIds.push(c.id);
    }

    await this.storage.set({ notified_challenge_ids: notifiedIds, notif_nav_map: navMap });
    chrome.action.setBadgeText({ text: pending.length > 0 ? String(pending.length) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#e03030' });
  }

  async getNavSlug(notifId: string): Promise<string | null> {
    const stored = await this.storage.get(['notif_nav_map']);
    const navMap = (stored['notif_nav_map'] as Record<string, string> | undefined) ?? {};
    return navMap[notifId] ?? null;
  }
}
