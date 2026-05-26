import { describe, it, expect } from 'vitest';
import { isSubstantive, stripStarterTemplate } from '@/content/editor';

const PY_STARTER = `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        `;

describe('editor', () => {
  it('treats unchanged starter as non-substantive', () => {
    expect(isSubstantive(PY_STARTER, PY_STARTER, 30)).toBe(false);
  });

  it('treats <30 added chars as non-substantive', () => {
    expect(isSubstantive(PY_STARTER + 'return []', PY_STARTER, 30)).toBe(false);
  });

  it('treats meaningful code as substantive', () => {
    const code = PY_STARTER + `seen = {}
        for i, n in enumerate(nums):
            if target - n in seen: return [seen[target-n], i]
            seen[n] = i`;
    expect(isSubstantive(code, PY_STARTER, 30)).toBe(true);
  });

  it('stripStarterTemplate removes the starter prefix when present', () => {
    const code = PY_STARTER + 'real code here';
    expect(stripStarterTemplate(code, PY_STARTER)).toBe('real code here');
  });

  it('substantive even without exact starter prefix match (whitespace tolerant)', () => {
    const noisy = '\n\n' + PY_STARTER + '\nreturn []';
    expect(isSubstantive(noisy, PY_STARTER, 5)).toBe(true);
  });
});
