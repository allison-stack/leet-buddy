import {
  interviewDebriefPrompt, interviewTurnPrompt, parseDebrief, parseInterviewTurn, stripFences,
} from '@/llm/interview-prompts';
import type { Debrief, InterviewAction, InterviewDebriefRequest, InterviewTurnRequest } from '@/shared/types';

export interface InterviewChatFn {
  (args: { systemPrompt: string; userPrompt: string; maxTokens: number }): Promise<{ text: string }>;
}

const TURN_MAX_TOKENS = 300;
const DEBRIEF_MAX_TOKENS = 900;

function reaskPrompt(user: string, err: Error): string {
  return `${user}\n\nYour previous reply was not valid JSON (${err.message}). Reply ONLY with the JSON object.`;
}

export async function runInterviewTurn(
  req: InterviewTurnRequest, chatFn: InterviewChatFn,
): Promise<{ say: string; action: InterviewAction }> {
  const { system, user } = interviewTurnPrompt(req);
  const first = await chatFn({ systemPrompt: system, userPrompt: user, maxTokens: TURN_MAX_TOKENS });
  try {
    return parseInterviewTurn(first.text);
  } catch (e) {
    const retry = await chatFn({
      systemPrompt: system, userPrompt: reaskPrompt(user, e as Error), maxTokens: TURN_MAX_TOKENS,
    });
    try {
      return parseInterviewTurn(retry.text);
    } catch {
      return { say: stripFences(retry.text), action: 'stay' };
    }
  }
}

export async function runInterviewDebrief(
  req: InterviewDebriefRequest, chatFn: InterviewChatFn,
): Promise<Debrief> {
  const { system, user } = interviewDebriefPrompt(req);
  const first = await chatFn({ systemPrompt: system, userPrompt: user, maxTokens: DEBRIEF_MAX_TOKENS });
  try {
    return parseDebrief(first.text);
  } catch (e) {
    const retry = await chatFn({
      systemPrompt: system, userPrompt: reaskPrompt(user, e as Error), maxTokens: DEBRIEF_MAX_TOKENS,
    });
    return parseDebrief(retry.text);
  }
}
