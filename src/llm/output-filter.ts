const CODE_BLOCK_RE = /```[\w]*\n[\s\S]*?```/g;
const REPLACEMENT = '[code removed — Leet Buddy hints stay in prose]';

export function stripCodeBlocks(text: string): string {
  return text.replace(CODE_BLOCK_RE, REPLACEMENT);
}
