import type { ChallengeManagerLike } from './challenge-manager';
import type { NotifierLike } from './notifier';

export class PollAlarm {
  constructor(
    private cm: ChallengeManagerLike,
    private sendToTabs: (msg: { type: string; [k: string]: unknown }) => Promise<void>,
    private notifier: NotifierLike,
  ) {}

  async tick(meId: string): Promise<void> {
    await this.cm.applyExpiries();
    const { pending, recent } = await this.cm.listInbox();
    await this.sendToTabs({ type: 'CHALLENGE_INBOX_UPDATED', pending, recent });
    await this.notifier.tick(pending, recent, meId);
  }
}
