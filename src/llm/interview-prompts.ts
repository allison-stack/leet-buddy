import type {
  Debrief, DebriefCategory, InterviewAction, InterviewDebriefRequest, InterviewPhase,
  InterviewTurnEvent, InterviewTurnRequest, MissedQuestion, TranscriptEntry,
} from '@/shared/types';

const PERSONA = `You are a friendly but rigorous technical interviewer at a top tech company, running a live coding interview.
HARD RULES (never violate):
1. NEVER reveal the approach or the solution, and NEVER write code. You may confirm, probe, and hint that something better exists ("can you do better than O(n^2)?"), but deflect "just tell me" like a real interviewer.
2. Replies are SPOKEN aloud: 1-3 sentences, hard cap. No lists, no markdown, no code.
3. If the problem statement does not answer a clarifying question, invent a reasonable constraint and stay consistent with it for the whole session.
4. If the candidate says "I don't know" or answers wrong: give ONE nudge that reframes the question. If they are still stuck, move on gracefully ("no problem, let's keep going"). Never reveal the answer mid-session, never dwell.`;

const PHASE_BRIEFS: Record<InterviewPhase, string> = {
  intro: 'Greet the candidate briefly, state the format (a timed session; they should talk through everything), and ask them to restate the problem in their own words. Emit "advance" once they have restated it reasonably.',
  clarify: 'Answer their clarifying questions (rule 3). If they skip straight to an approach without asking anything, nudge once — "before you dive in, anything you want to clarify?" — then follow their lead. When they run out of questions or move on, emit "advance".',
  approach: 'Probe their plan: time/space complexity, edge cases. If it is brute force, ask once whether they can do better. Emit "advance" only when the plan is coherent and defended.',
  coding: 'React to their narration and code snapshots; ask short pointed questions about what they wrote. If they claim they are finished and the code looks plausibly complete, emit "end".',
  debrief: 'The session is over.',
  ended: 'The session is over.',
};

const TRIGGER_NOTES: Record<InterviewTurnEvent, string> = {
  session_start: 'The session is just starting. Deliver your intro-phase greeting now.',
  user_turn: 'The candidate just said the last CANDIDATE line. Respond to it.',
  candidate_silent: 'The candidate has been quiet for a while during coding. Nudge them to think out loud — e.g. "talk to me, what are you thinking?"',
  code_before_approach: 'The candidate started writing code before explaining an approach. Kindly ask them to walk you through their approach first.',
};

const TURN_FORMAT = `RESPONSE FORMAT: reply ONLY with a JSON object, no other text:
{"say": "<what you say aloud, 1-3 sentences>", "action": "stay" | "advance" | "end"}
"advance" means the candidate has completed the current phase and the interview moves to the next one. When you use "advance", your "say" must already speak in the NEXT phase's voice (e.g. acknowledge the approach and probe it — no lag). "end" means the interview should wrap up now.`;

function renderTranscript(entries: TranscriptEntry[]): string {
  if (entries.length === 0) return '(nothing said yet)';
  return entries.map(e =>
    e.role === 'candidate' ? `CANDIDATE: ${e.text}`
    : e.role === 'interviewer' ? `INTERVIEWER: ${e.text}`
    : `[EVENT: ${e.text}]`,
  ).join('\n');
}

export function interviewTurnPrompt(req: InterviewTurnRequest): { system: string; user: string } {
  const system = `${PERSONA}

CURRENT PHASE: ${req.phase} — ${PHASE_BRIEFS[req.phase]}

PROBLEM (${req.difficulty}, "${req.title}"):
${req.problemStatement}

${TURN_FORMAT}`;

  const codeSection = req.code !== undefined
    ? `\n\nCandidate's current code:\n${req.code}`
    : '';

  const user = `Transcript so far:
${renderTranscript(req.transcript)}${codeSection}

${TRIGGER_NOTES[req.trigger]}`;

  return { system, user };
}

const DEBRIEF_SYSTEM = `You are the same technical interviewer, now writing the post-interview debrief. Grade honestly, like a hire/no-hire committee note — specific, kind, and useful.

Reply ONLY with a JSON object, no other text, in exactly this shape:
{
  "categories": [
    {"name": "communication", "score": 1-4, "evidence": "<a VERBATIM quote from the transcript>", "improvement": "<one concrete thing to do differently next time>"},
    {"name": "problem-solving", ...}, {"name": "code quality", ...}, {"name": "complexity analysis", ...}
  ],
  "missedQuestions": [{"question": "...", "yourAnswer": "...", "correctAnswer": "..."}],
  "processMisses": ["..."],
  "spokenSummary": "<max 3 sentences, spoken aloud>"
}

Rules:
- "evidence" must be a verbatim quote from the transcript; do not paraphrase.
- "missedQuestions" must list EVERY question the candidate answered incorrectly or could not answer, each with the correct answer. Empty array if none.
- "processMisses" lists interview-process failures with what they cost: asked zero clarifying questions, started coding before explaining the approach (the code_before_approach event), silent coding stretches (candidate_silent events). Empty array if none.`;

export function interviewDebriefPrompt(req: InterviewDebriefRequest): { system: string; user: string } {
  const user = `PROBLEM (${req.difficulty}, "${req.title}"):
${req.problemStatement}

Outcome: ${req.solveStatus} after ${Math.round(req.elapsedMs / 60_000)} minutes.

Full transcript:
${renderTranscript(req.transcript)}

Final code:
${req.finalCode || '(no code written)'}`;
  return { system: DEBRIEF_SYSTEM, user };
}

export function stripFences(text: string): string {
  return text.trim().replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
}

function parseJsonLoose(text: string): unknown {
  const cleaned = stripFences(text);
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) throw e;
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function parseInterviewTurn(text: string): { say: string; action: InterviewAction } {
  const parsed = parseJsonLoose(text) as { say?: unknown; action?: unknown };
  if (typeof parsed.say !== 'string' || parsed.say.trim() === '') throw new Error('reply missing "say"');
  const action: InterviewAction =
    parsed.action === 'advance' || parsed.action === 'end' ? parsed.action : 'stay';
  return { say: parsed.say.trim(), action };
}

export function parseDebrief(text: string): Debrief {
  const parsed = parseJsonLoose(text) as Partial<Record<keyof Debrief, unknown>>;
  const rawCategories = Array.isArray(parsed.categories) ? parsed.categories.filter(isRecord) : [];
  if (rawCategories.length === 0) throw new Error('debrief missing categories');
  if (typeof parsed.spokenSummary !== 'string') throw new Error('debrief missing spokenSummary');
  const categories: DebriefCategory[] = rawCategories.map(c => ({
    name: String(c['name'] ?? ''),
    score: (c['score'] === 1 || c['score'] === 2 || c['score'] === 3 || c['score'] === 4 ? c['score'] : 1),
    evidence: String(c['evidence'] ?? ''),
    improvement: String(c['improvement'] ?? ''),
  }));
  const missedQuestions: MissedQuestion[] = Array.isArray(parsed.missedQuestions)
    ? parsed.missedQuestions.filter(isRecord).map(m => ({
        question: String(m['question'] ?? ''),
        yourAnswer: String(m['yourAnswer'] ?? ''),
        correctAnswer: String(m['correctAnswer'] ?? ''),
      }))
    : [];
  const processMisses = Array.isArray(parsed.processMisses)
    ? parsed.processMisses.filter((m): m is string => typeof m === 'string')
    : [];
  return { categories, missedQuestions, processMisses, spokenSummary: parsed.spokenSummary };
}
