export interface RaceTimerEntry {
  challengeId: string;
  acceptedAt: number; // epoch ms
}

export class RaceTimer {
  private key(tabId: number): string {
    return `race_timer_${tabId}`;
  }

  async start(tabId: number, challengeId: string, acceptedAt: number): Promise<void> {
    await chrome.storage.local.set({ [this.key(tabId)]: { challengeId, acceptedAt } });
  }

  async stop(tabId: number): Promise<void> {
    await chrome.storage.local.remove([this.key(tabId)]);
  }

  async get(tabId: number): Promise<RaceTimerEntry | null> {
    const result = await chrome.storage.local.get([this.key(tabId)]);
    return (result[this.key(tabId)] as RaceTimerEntry | undefined) ?? null;
  }
}
