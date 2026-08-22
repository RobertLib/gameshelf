import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney, gamesLabel, pluralize } from './format';

describe('formatMoney', () => {
  it('writes a whole amount without decimal zeros', () => {
    expect(formatMoney(2490, 'USD')).toBe('$2,490');
  });

  it('writes an amount with cents to two places', () => {
    expect(formatMoney(349.5, 'USD')).toBe('$349.50');
  });

  it('leaves just the number without a currency', () => {
    expect(formatMoney(100, null)).toBe('100');
  });

  it('shows an unfilled price as a dash', () => {
    expect(formatMoney(null, 'USD')).toBe('—');
  });
});

describe('formatDate', () => {
  it('turns an API date into readable text', () => {
    expect(formatDate('2004-12-28')).toBe('December 28, 2004');
  });

  it('an empty date is a dash', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('returns nonsense input unchanged, never "Invalid Date"', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('pluralize', () => {
  it('picks the singular only for exactly one', () => {
    const forms: [string, string] = ['game', 'games'];
    expect(pluralize(1, forms)).toBe('game');
    expect(pluralize(3, forms)).toBe('games');
    expect(pluralize(0, forms)).toBe('games');
  });
});

describe('gamesLabel', () => {
  it('joins the count with the right form', () => {
    expect(gamesLabel(1)).toBe('1 game');
    expect(gamesLabel(4)).toBe('4 games');
    expect(gamesLabel(12)).toBe('12 games');
  });
});
