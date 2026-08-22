import { describe, expect, it } from 'vitest';
import {
  gameListQuerySchema,
  type CollectionOverview,
} from '@gameshelf/contracts';
import { buildChips } from './active-filter-chips';

const query = (search: string) =>
  gameListQuerySchema.parse(
    Object.fromEntries(new URLSearchParams(search).entries()),
  );

const overview = {
  facets: {
    platforms: [{ value: 'p1', label: 'PlayStation 2', count: 3 }],
    genres: [{ value: 'g1', label: 'Adventure', count: 2 }],
  },
} as unknown as CollectionOverview;

const chipsOf = (search: string) =>
  buildChips(query(search), overview).map((chip) => chip.key);

describe('buildChips', () => {
  it('returns nothing without any filters', () => {
    expect(buildChips(query(''), overview)).toEqual([]);
  });

  it('uses the label from the overview for a lookup value, not the ID', () => {
    const [chip] = buildChips(query('?platformIds=p1'), overview);
    expect(chip?.label).toBe('PlayStation 2');
  });

  it('shows at least the value while the overview is not there yet', () => {
    const [chip] = buildChips(query('?platformIds=p1'), undefined);
    expect(chip?.label).toBe('p1');
  });

  it('returns a chip for every item of a multi-value filter', () => {
    expect(chipsOf('?regions=PAL,NTSC_J')).toEqual([
      'region-PAL',
      'region-NTSC_J',
    ]);
  });

  it('clearing one value leaves the others in place', () => {
    const chip = buildChips(query('?regions=PAL,NTSC_J'), overview).find(
      (c) => c.key === 'region-PAL',
    );
    expect(chip?.clear).toEqual({ regions: ['NTSC_J'] });
  });

  it('clearing the last value removes the parameter entirely', () => {
    const [chip] = buildChips(query('?regions=PAL'), overview);
    expect(chip?.clear).toEqual({ regions: undefined });
  });

  /**
   * Regression: a chip existed for only one position of the toggle, so
   * `?hasCover=true` from a hand-edited address counted towards the "active
   * filters" but could not be cleared other than by deleting every filter.
   */
  it('has a chip for both positions of the toggles', () => {
    expect(chipsOf('?hasCover=false')).toEqual(['cover']);
    expect(chipsOf('?hasCover=true')).toEqual(['cover']);
    expect(chipsOf('?isFavorite=false')).toEqual(['favorite']);
    expect(chipsOf('?unrated=false')).toEqual(['unrated']);
  });

  it('tells the labels of the two positions apart', () => {
    expect(buildChips(query('?hasCover=true'), overview)[0]?.label).toBe(
      'With a cover',
    );
    expect(buildChips(query('?hasCover=false'), overview)[0]?.label).toBe(
      'Without a cover',
    );
  });

  /** The `purchasedFrom` filter used to be in neither the panel nor the chips. */
  it('covers the "bought from" filter too', () => {
    const [chip] = buildChips(query('?purchasedFrom=eBay'), overview);
    expect(chip?.label).toBe('eBay');
    expect(chip?.clear).toEqual({ purchasedFrom: undefined });
  });

  it('writes a range as a single chip with an open end', () => {
    const [chip] = buildChips(query('?yearFrom=1995'), overview);
    expect(chip?.label).toBe('Year 1995–…');
    expect(chip?.clear).toEqual({ yearFrom: undefined, yearTo: undefined });
  });
});
