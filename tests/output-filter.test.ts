import { describe, it, expect } from 'vitest';
import { stripCodeBlocks } from '@/llm/output-filter';

describe('stripCodeBlocks', () => {
  it('removes fenced code blocks with language tag', () => {
    const input = 'Try this:\n```python\ndef foo(): pass\n```\nDone.';
    expect(stripCodeBlocks(input)).toBe('Try this:\n[code removed — Leet Buddy hints stay in prose]\nDone.');
  });

  it('removes fenced blocks without language tag', () => {
    const input = 'Note:\n```\nx = 1\n```\nend';
    expect(stripCodeBlocks(input)).toBe('Note:\n[code removed — Leet Buddy hints stay in prose]\nend');
  });

  it('passes through prose untouched', () => {
    expect(stripCodeBlocks('Use a hash map for O(1) lookup.')).toBe('Use a hash map for O(1) lookup.');
  });

  it('handles multiple blocks', () => {
    const input = 'a\n```ts\n1\n```\nb\n```\n2\n```\nc';
    const out = stripCodeBlocks(input);
    expect((out.match(/\[code removed/g) ?? []).length).toBe(2);
  });
});
