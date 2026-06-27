// Any triple-backtick span, single- or multi-line. The earlier `\n`-after-fence
// requirement let one-liners like ```dp[i] = dp[i-1] + dp[i-2]``` slip through.
const CODE_BLOCK_RE = /```[\s\S]*?```/g;
const REPLACEMENT = '[code removed — Leet Buddy hints stay in prose]';

export function stripCodeBlocks(text: string): string {
  return text.replace(CODE_BLOCK_RE, REPLACEMENT);
}
