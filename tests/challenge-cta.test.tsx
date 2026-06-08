import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChallengeCTA } from '@/content/components/challenger/ChallengeCTA';

afterEach(() => cleanup());

describe('ChallengeCTA', () => {
  it('displays formatted solve time', () => {
    render(<ChallengeCTA timeMs={195000} onChallenge={() => {}} />);
    expect(screen.getByText(/3:15/)).toBeTruthy();
  });

  it('calls onChallenge when button clicked', () => {
    let called = false;
    render(<ChallengeCTA timeMs={60000} onChallenge={() => { called = true; }} />);
    fireEvent.click(screen.getByRole('button'));
    expect(called).toBe(true);
  });
});
