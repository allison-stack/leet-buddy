import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RubricCard } from '@/content/components/interview/RubricCard';
import type { Debrief } from '@/shared/types';

afterEach(() => cleanup());

const debrief: Debrief = {
  categories: [
    { name: 'communication', score: 3, evidence: 'so I will use two pointers', improvement: 'state complexity unprompted' },
    { name: 'complexity analysis', score: 2, evidence: 'uh, O(n log n)?', improvement: 'derive it from the loops' },
  ],
  missedQuestions: [
    { question: 'HashMap insertion complexity?', yourAnswer: 'O(log n)', correctAnswer: 'amortized O(1)' },
  ],
  processMisses: ['asked zero clarifying questions'],
  spokenSummary: 'Decent structure, shaky complexity.',
};

describe('RubricCard', () => {
  it('renders each category with score, evidence, and improvement', () => {
    render(<RubricCard debrief={debrief} onClose={() => {}} />);
    expect(screen.getByText(/communication/i)).toBeTruthy();
    expect(screen.getByText(/3\/4/)).toBeTruthy();
    expect(screen.getByText(/so I will use two pointers/)).toBeTruthy();
    expect(screen.getByText(/state complexity unprompted/)).toBeTruthy();
  });

  it('renders missed questions with correct answers and process misses', () => {
    render(<RubricCard debrief={debrief} onClose={() => {}} />);
    expect(screen.getByText(/amortized O\(1\)/)).toBeTruthy();
    expect(screen.getByText(/asked zero clarifying questions/)).toBeTruthy();
  });

  it('omits the missed-questions section when empty', () => {
    render(<RubricCard debrief={{ ...debrief, missedQuestions: [] }} onClose={() => {}} />);
    expect(screen.queryByText(/missed questions/i)).toBeNull();
  });

  it('calls onClose', () => {
    let closed = false;
    render(<RubricCard debrief={debrief} onClose={() => { closed = true; }} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(closed).toBe(true);
  });
});
