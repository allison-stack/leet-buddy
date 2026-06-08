import type { ChallengeManagerLike } from './challenge-manager';

export class PollAlarm {
  constructor(
    private cm: ChallengeManagerLike,
    private sendToTabs: (msg: { type: string; [k: string]: unknown }) => Promise<void>,
  ) {}

  async tick(): Promise<void> {
    await this.cm.applyExpiries();
    const { pending, recent } = await this.cm.listInbox();
    await this.sendToTabs({ type: 'CHALLENGE_INBOX_UPDATED', pending, recent });
  }
}
