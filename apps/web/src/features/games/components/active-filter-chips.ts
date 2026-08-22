import {
  type CollectionOverview,
  type GameListQuery,
  type GameListQueryInput,
} from '@gameshelf/contracts';
import { ENUM_FACETS, enumFacetPatch, selectedValues } from './enum-facets';

export interface Chip {
  key: string;
  label: string;
  clear: Partial<GameListQueryInput>;
}

/**
 * Every filter that can be set has to be clearable too - including the ones the
 * panel itself does not offer and which arrive only in a hand-edited address.
 * Otherwise `activeCount` would report an active filter with no visible chip,
 * and the only way back would be "Clear filters".
 */
export function buildChips(
  query: GameListQuery,
  overview: CollectionOverview | undefined,
): Chip[] {
  const chips: Chip[] = [];
  const nameOf = (
    list: Array<{ value: string; label: string }> | undefined,
    value: string,
  ): string => list?.find((item) => item.value === value)?.label ?? value;

  if (query.q) {
    chips.push({ key: 'q', label: `"${query.q}"`, clear: { q: undefined } });
  }

  for (const id of query.platformIds ?? []) {
    chips.push({
      key: `platform-${id}`,
      label: nameOf(overview?.facets.platforms, id),
      clear: { platformIds: without(query.platformIds, id) },
    });
  }

  for (const id of query.genreIds ?? []) {
    chips.push({
      key: `genre-${id}`,
      label: nameOf(overview?.facets.genres, id),
      clear: { genreIds: without(query.genreIds, id) },
    });
  }

  for (const { key, chipPrefix, labels } of ENUM_FACETS) {
    const selected = selectedValues(query, key);
    for (const value of selected) {
      chips.push({
        key: `${chipPrefix}-${value}`,
        label: labels[value] ?? value,
        clear: enumFacetPatch(key, without(selected, value)),
      });
    }
  }

  if (query.yearFrom !== undefined || query.yearTo !== undefined) {
    chips.push({
      key: 'year',
      label: `Year ${query.yearFrom ?? '…'}–${query.yearTo ?? '…'}`,
      clear: { yearFrom: undefined, yearTo: undefined },
    });
  }

  if (query.ratingFrom !== undefined || query.ratingTo !== undefined) {
    chips.push({
      key: 'rating',
      label: `Rating ${query.ratingFrom ?? '…'}–${query.ratingTo ?? '…'}`,
      clear: { ratingFrom: undefined, ratingTo: undefined },
    });
  }

  if (query.priceFrom !== undefined || query.priceTo !== undefined) {
    chips.push({
      key: 'price',
      label: `Price ${query.priceFrom ?? '…'}–${query.priceTo ?? '…'}`,
      clear: { priceFrom: undefined, priceTo: undefined },
    });
  }

  if (query.storageLocation) {
    chips.push({
      key: 'storage',
      label: query.storageLocation,
      clear: { storageLocation: undefined },
    });
  }
  if (query.developer) {
    chips.push({
      key: 'developer',
      label: query.developer,
      clear: { developer: undefined },
    });
  }
  if (query.publisher) {
    chips.push({
      key: 'publisher',
      label: query.publisher,
      clear: { publisher: undefined },
    });
  }
  if (query.purchasedFrom) {
    chips.push({
      key: 'purchasedFrom',
      label: query.purchasedFrom,
      clear: { purchasedFrom: undefined },
    });
  }

  if (query.isFavorite !== undefined) {
    chips.push({
      key: 'favorite',
      label: query.isFavorite ? 'Favorites' : 'Not favorites',
      clear: { isFavorite: undefined },
    });
  }
  if (query.hasCover !== undefined) {
    chips.push({
      key: 'cover',
      label: query.hasCover ? 'With a cover' : 'Without a cover',
      clear: { hasCover: undefined },
    });
  }
  if (query.unrated !== undefined) {
    chips.push({
      key: 'unrated',
      label: query.unrated ? 'Not rated' : 'Rated only',
      clear: { unrated: undefined },
    });
  }

  return chips;
}

/** Removes a value from a list; an empty result is `undefined`, not `[]`. */
function without<T extends string>(
  list: T[] | undefined,
  value: T,
): T[] | undefined {
  const next = (list ?? []).filter((item) => item !== value);
  return next.length > 0 ? next : undefined;
}
