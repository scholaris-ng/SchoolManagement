import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FilterBar } from './filter-bar';
import { DateRangeFilter, dateRangeChips, type DateRangeFilterDefinition } from './date-range-filter';

function definition(onChange = vi.fn()): DateRangeFilterDefinition {
  return { label: 'Paid', fromKey: 'dateFrom', toKey: 'dateTo', onChange };
}

const pick = (name: string, value: string) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } });

describe('DateRangeFilter', () => {
  afterEach(cleanup);

  it('shows the two ends it was given', () => {
    render(
      <DateRangeFilter
        definition={definition()}
        values={{ dateFrom: '2026-09-01', dateTo: '2026-09-30' }}
      />,
    );
    expect(screen.getByLabelText('Paid from')).toHaveValue('2026-09-01');
    expect(screen.getByLabelText('Paid to')).toHaveValue('2026-09-30');
  });

  it('writes only the end that was changed when the interval stays in order', () => {
    const onChange = vi.fn();
    render(
      <DateRangeFilter
        definition={definition(onChange)}
        values={{ dateFrom: '2026-09-01', dateTo: '2026-09-30' }}
      />,
    );

    pick('Paid from', '2026-09-10');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ dateFrom: '2026-09-10' });
  });

  it('drags the end along when the start is moved past it, in one write', () => {
    const onChange = vi.fn();
    render(
      <DateRangeFilter
        definition={definition(onChange)}
        values={{ dateFrom: '2026-09-01', dateTo: '2026-09-30' }}
      />,
    );

    pick('Paid from', '2026-10-05');

    // One call, not two: two calls in a tick would each start from the same
    // stale URL, and the second would undo the first.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ dateFrom: '2026-10-05', dateTo: '2026-10-05' });
  });

  it('drags the start along when the end is moved before it', () => {
    const onChange = vi.fn();
    render(
      <DateRangeFilter
        definition={definition(onChange)}
        values={{ dateFrom: '2026-09-10', dateTo: '2026-09-30' }}
      />,
    );

    pick('Paid to', '2026-09-02');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ dateFrom: '2026-09-02', dateTo: '2026-09-02' });
  });

  it('accepts a start with no end yet, without inventing one', () => {
    const onChange = vi.fn();
    render(<DateRangeFilter definition={definition(onChange)} values={{}} />);

    pick('Paid from', '2026-09-10');

    expect(onChange).toHaveBeenCalledWith({ dateFrom: '2026-09-10' });
  });

  it('clears just the end that was emptied', () => {
    const onChange = vi.fn();
    render(
      <DateRangeFilter
        definition={definition(onChange)}
        values={{ dateFrom: '2026-09-01', dateTo: '2026-09-30' }}
      />,
    );

    pick('Paid to', '');

    expect(onChange).toHaveBeenCalledWith({ dateTo: undefined });
  });

  it('stops the picker offering an end before the start, and a start after the end', () => {
    render(
      <DateRangeFilter
        definition={definition()}
        values={{ dateFrom: '2026-09-10', dateTo: '2026-09-20' }}
      />,
    );

    expect(screen.getByLabelText('Paid to')).toHaveAttribute('min', '2026-09-10');
    expect(screen.getByLabelText('Paid from')).toHaveAttribute('max', '2026-09-20');
  });

  it('sets no bounds while the other end is empty', () => {
    render(<DateRangeFilter definition={definition()} values={{}} />);

    expect(screen.getByLabelText('Paid to')).not.toHaveAttribute('min');
    expect(screen.getByLabelText('Paid from')).not.toHaveAttribute('max');
  });
});

describe('dateRangeChips', () => {
  it('makes one chip per end that is set, worded with what the dates are of', () => {
    expect(
      dateRangeChips(definition(), { dateFrom: '2026-09-01', dateTo: '2026-09-30' }),
    ).toEqual([
      { key: 'dateFrom', label: 'Paid from', value: '1 Sep 2026' },
      { key: 'dateTo', label: 'Paid to', value: '30 Sep 2026' },
    ]);
  });

  it('makes none for an end that is not set', () => {
    expect(dateRangeChips(definition(), { dateTo: '2026-09-30' })).toEqual([
      { key: 'dateTo', label: 'Paid to', value: '30 Sep 2026' },
    ]);
    expect(dateRangeChips(definition(), {})).toEqual([]);
  });
});

describe('FilterBar with a date range', () => {
  afterEach(cleanup);

  it('shows a removable chip per end, and removing one clears only that key', () => {
    const onFilterChange = vi.fn();
    render(
      <FilterBar
        values={{ dateFrom: '2026-09-01', dateTo: '2026-09-30' }}
        onFilterChange={onFilterChange}
        dateRange={definition()}
      />,
    );

    expect(screen.getByText('1 Sep 2026')).toBeInTheDocument();
    expect(screen.getByText('30 Sep 2026')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Paid from filter' }));

    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith('dateFrom', undefined);
  });

  it('offers "Clear all" once a date is set, even with no dropdown filter chosen', () => {
    render(
      <FilterBar
        values={{ dateTo: '2026-09-30' }}
        onFilterChange={vi.fn()}
        onReset={vi.fn()}
        dateRange={definition()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Clear all' })).toBeInTheDocument();
  });

  it('shows no chips and no "Clear all" while no date is set', () => {
    render(
      <FilterBar values={{}} onFilterChange={vi.fn()} onReset={vi.fn()} dateRange={definition()} />,
    );

    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
  });
});
