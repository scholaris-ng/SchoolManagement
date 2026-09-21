import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

/**
 * The real tooltip takes ~25 seconds to open under jsdom — a bare one around a
 * plain button does too — so it is swapped for one that puts its content where
 * a test can read it. What is under test is what the badge tells the tooltip to
 * say, and how the badge is built around it, not Radix's popup.
 */
vi.mock('@/components/ui/feedback', () => ({
  Tooltip: ({ content, children }: { content: React.ReactNode; children: React.ReactNode }) => (
    <div data-tooltip={String(content)}>{children}</div>
  ),
}));

import { SEVERITY_MEANING, SeverityBadge } from './audit-severity';

afterEach(cleanup);

const tooltipOf = (name: string) =>
  screen.getByText(name).closest('[data-tooltip]')?.getAttribute('data-tooltip');

describe('SeverityBadge', () => {
  it('shows the level as it always did', () => {
    render(<SeverityBadge severity="WARNING" />);
    expect(screen.getByText('WARNING')).toBeInTheDocument();
  });

  it('explains each level on hover', () => {
    for (const severity of ['INFO', 'WARNING', 'CRITICAL'] as const) {
      const { unmount } = render(<SeverityBadge severity={severity} />);
      expect(tooltipOf(severity)).toBe(SEVERITY_MEANING[severity]);
      unmount();
    }
  });

  it('tells WARNING apart from a failure, which is what people wonder about it', () => {
    expect(SEVERITY_MEANING.WARNING).toMatch(/not an error/);
    expect(SEVERITY_MEANING.WARNING).toMatch(/sensitive change/);
  });

  it('says CRITICAL is about who can do what, and that administrators are told', () => {
    expect(SEVERITY_MEANING.CRITICAL).toMatch(/who can do what/);
    expect(SEVERITY_MEANING.CRITICAL).toMatch(/administrators are notified/);
  });

  it('gives each level its own explanation', () => {
    const meanings = Object.values(SEVERITY_MEANING);
    expect(new Set(meanings).size).toBe(meanings.length);
    for (const meaning of meanings) expect(meaning.length).toBeGreaterThan(20);
  });

  it('is not a tab stop, so it adds none to a list and never takes a dialog\'s opening focus', () => {
    render(<SeverityBadge severity="WARNING" />);
    const anchor = screen.getByText('WARNING').closest('[data-cy="audit-severity-warning"]');
    expect(anchor).not.toBeNull();
    expect(anchor).not.toHaveAttribute('tabindex');
  });

  it('adds the meaning as screen-reader text only when asked, so a long list is not read out row by row', () => {
    const { unmount } = render(<SeverityBadge severity="WARNING" />);
    expect(screen.queryByText(/A sensitive change/)).not.toBeInTheDocument();
    unmount();

    render(<SeverityBadge severity="WARNING" describe />);
    expect(screen.getByText(/A sensitive change, such as a deletion/)).toHaveClass('sr-only');
  });
});
