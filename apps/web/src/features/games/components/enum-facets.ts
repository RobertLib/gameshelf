import {
  COMPLETENESS_LABELS,
  CONDITION_LABELS,
  PLAY_STATUS_LABELS,
  REGION_LABELS,
  type GameListQuery,
  type GameListQueryInput,
} from '@gameshelf/contracts';

/** The filters chosen from a fixed set of values. */
export type EnumFacetKey =
  'conditions' | 'completeness' | 'statuses' | 'regions';

interface EnumFacet {
  /** The key in the query - by coincidence also in `overview.facets`, so one suffices. */
  key: EnumFacetKey;
  /** The section heading in the filter panel. */
  title: string;
  /** Prefix of the chip key; singular, because a chip carries a single value. */
  chipPrefix: string;
  labels: Record<string, string>;
}

/**
 * The four enum filters in one place.
 *
 * They behave exactly the same in the panel and among the chips - they differ
 * only in their key, heading and labels. While they were four copied blocks in
 * each of the two files, a new enum meant eight edits; and had one been
 * forgotten, the filter could be switched on but not off other than with the
 * "Clear filters" button.
 */
export const ENUM_FACETS: readonly EnumFacet[] = [
  {
    key: 'conditions',
    title: 'Condition',
    chipPrefix: 'condition',
    labels: CONDITION_LABELS,
  },
  {
    key: 'completeness',
    title: 'Completeness',
    chipPrefix: 'completeness',
    labels: COMPLETENESS_LABELS,
  },
  {
    key: 'statuses',
    title: 'Play status',
    chipPrefix: 'status',
    labels: PLAY_STATUS_LABELS,
  },
  {
    key: 'regions',
    title: 'Region',
    chipPrefix: 'region',
    labels: REGION_LABELS,
  },
];

/**
 * The selected values of a single enum filter.
 *
 * Over a union of keys, `query[key]` is again a union of arrays (`Region[] |
 * Condition[] | …`), which is miserable to work with. Both the panel and the
 * chips treat the values as opaque strings, so it is unified here.
 */
export function selectedValues(
  query: GameListQuery,
  key: EnumFacetKey,
): string[] {
  return query[key] ?? [];
}

/**
 * A change to a single enum filter. Its own function because TypeScript does not
 * narrow an object literal with a key from a union (`{ [key]: values }`) to the
 * concrete field.
 */
export function enumFacetPatch(
  key: EnumFacetKey,
  values: string[] | undefined,
): Partial<GameListQueryInput> {
  return { [key]: values };
}
