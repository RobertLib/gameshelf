import { describe, expect, it } from 'vitest';
import {
  countActiveFilters,
  nextFilterParams,
  parseGameFilters,
  toRawFilters,
} from './use-game-filters';

const parse = (search: string) =>
  parseGameFilters(toRawFilters(new URLSearchParams(search)));

describe('toRawFilters', () => {
  it('joins a repeated parameter so no values are lost from the selection', () => {
    // A hand-written or copied address may carry the same key several times.
    expect(
      toRawFilters(new URLSearchParams('?regions=PAL&regions=NTSC_U')),
    ).toEqual({ regions: 'PAL,NTSC_U' });
  });

  it('leaves a single value alone', () => {
    expect(toRawFilters(new URLSearchParams('?q=zelda&page=3'))).toEqual({
      q: 'zelda',
      page: '3',
    });
  });
});

describe('parseGameFilters', () => {
  it('fills in the default sorting and pagination', () => {
    expect(parse('')).toMatchObject({
      sort: 'title',
      order: 'asc',
      page: 1,
      genreMatch: 'any',
    });
  });

  it('parses a list written either way identically', () => {
    expect(parse('?regions=PAL,NTSC_U').regions).toEqual(['PAL', 'NTSC_U']);
    expect(parse('?regions=PAL&regions=NTSC_U').regions).toEqual([
      'PAL',
      'NTSC_U',
    ]);
  });

  it('drops only the invalid parameter, not the whole filter', () => {
    // Regression: one bad value used to reset the whole selection to the default.
    const query = parse('?q=zelda&platformIds=p1&yearFrom=1');

    expect(query.q).toBe('zelda');
    expect(query.platformIds).toEqual(['p1']);
    expect(query.yearFrom).toBeUndefined();
  });

  it('does not crash even on a completely nonsensical address', () => {
    expect(parse('?sort=nope&order=upwards&page=-5').sort).toBe('title');
  });
});

describe('nextFilterParams', () => {
  it('drops the page when a filter changes', () => {
    const next = nextFilterParams({ q: 'zelda', page: '4' }, { q: 'mario' });

    expect(next.get('q')).toBe('mario');
    expect(next.has('page')).toBe(false);
  });

  it('keeps the page while paginating', () => {
    const next = nextFilterParams({ q: 'zelda', page: '4' }, { page: 5 });

    expect(next.get('page')).toBe('5');
    expect(next.get('q')).toBe('zelda');
  });

  it('removes an undefined parameter from the address', () => {
    const next = nextFilterParams(
      { q: 'zelda', regions: 'PAL' },
      { regions: undefined },
    );

    expect(next.has('regions')).toBe(false);
    expect(next.get('q')).toBe('zelda');
  });

  it('joins an array with commas and omits an empty array', () => {
    expect(
      nextFilterParams({}, { regions: ['PAL', 'NTSC_J'] }).get('regions'),
    ).toBe('PAL,NTSC_J');
    expect(nextFilterParams({}, { regions: [] }).has('regions')).toBe(false);
  });

  it('can write `false` too, not just `true`', () => {
    // `hasCover=false` means "only without a cover"; if it fell out as an empty
    // value, the filter would silently switch off.
    expect(nextFilterParams({}, { hasCover: false }).get('hasCover')).toBe(
      'false',
    );
  });
});

describe('countActiveFilters', () => {
  it('counts neither sorting nor pagination', () => {
    expect(countActiveFilters(parse('?sort=rating&order=desc&page=2'))).toBe(0);
  });

  it('counts every filter once, even a multi-value one', () => {
    expect(
      countActiveFilters(parse('?q=zelda&regions=PAL,NTSC_U&isFavorite=true')),
    ).toBe(3);
  });

  it('counts `false` too, because that is an active filter as well', () => {
    expect(countActiveFilters(parse('?hasCover=false'))).toBe(1);
  });
});
