import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  gameListQuerySchema,
  toSearchParams,
  type GameListQuery,
  type GameListQueryInput,
} from '@gameshelf/contracts';

/**
 * The filters are stored in the URL, not in component state.
 *
 * That makes the back button work, lets a link to a particular selection be
 * shared ("my unfinished PS2 games sorted by year") and loses nothing on a page
 * reload. Parsing is done by the same schema the backend uses, so a hand-edited
 * address ends either in a valid filter or in the default state - never in a
 * crash.
 *
 * The logic deliberately sits in the pure functions below: the combinatorics of
 * fifteen filters can be tested without React and without the router.
 */
export function useGameFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = useMemo(() => toRawFilters(searchParams), [searchParams]);
  const query = useMemo(() => parseGameFilters(raw), [raw]);

  /**
   * Writes a filter change into the URL. When anything other than the page
   * changes, we go back to the first page - otherwise narrowing the selection
   * would leave an empty page eight. A filter change also only replaces the
   * history entry, so the back button does not walk through every keystroke in
   * the search field.
   */
  const update = useCallback(
    (patch: Partial<GameListQueryInput>) => {
      setSearchParams(nextFilterParams(raw, patch), {
        replace: !('page' in patch),
      });
    },
    [raw, setSearchParams],
  );

  const reset = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  /** How many filters are active (sorting and pagination do not count). */
  const activeCount = useMemo(() => countActiveFilters(query), [query]);

  return { query, update, reset, activeCount };
}

/* ------------------------------------------------------------------ *
 * Pure functions
 * ------------------------------------------------------------------ */

/**
 * `URLSearchParams` -> a plain object the schema can work with.
 *
 * A repeated key is joined with a comma, because `?regions=PAL&regions=NTSC_U`
 * is just as valid a spelling as `?regions=PAL,NTSC_U` and `csvOf` in the
 * contracts understands both. The application itself only produces the latter
 * form, but a hand-written or copied address may arrive in the former - and
 * `Object.fromEntries` would keep only the last value, so part of the selection
 * would vanish.
 */
export function toRawFilters(
  searchParams: URLSearchParams,
): Record<string, string> {
  const raw: Record<string, string> = {};
  for (const key of new Set(searchParams.keys())) {
    raw[key] = searchParams.getAll(key).join(',');
  }
  return raw;
}

/**
 * Invalid values are dropped one at a time, not the whole filter at once.
 *
 * A single hand-edited parameter (`?yearFrom=1`) used to be enough for the
 * fallback to `parse({})` to erase everything else - the user lost their search
 * term and their selected platforms over a single digit.
 */
export function parseGameFilters(raw: Record<string, string>): GameListQuery {
  const parsed = gameListQuerySchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  const cleaned = { ...raw };
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string') delete cleaned[key];
  }

  const retry = gameListQuerySchema.safeParse(cleaned);
  return retry.success ? retry.data : gameListQuerySchema.parse({});
}

/** The new query string after a filter change. */
export function nextFilterParams(
  raw: Record<string, string>,
  patch: Partial<GameListQueryInput>,
): URLSearchParams {
  const next: Record<string, unknown> = { ...raw, ...patch };
  if (!('page' in patch)) delete next['page'];
  return toSearchParams(next);
}

const NON_FILTER_KEYS = new Set<keyof GameListQuery>([
  'sort',
  'order',
  'page',
  'pageSize',
  'genreMatch',
]);

export function countActiveFilters(query: GameListQuery): number {
  return Object.entries(query).reduce((count, [key, value]) => {
    if (NON_FILTER_KEYS.has(key as keyof GameListQuery)) return count;
    if (value === undefined || value === null || value === '') return count;
    if (Array.isArray(value)) return count + (value.length > 0 ? 1 : 0);
    return count + 1;
  }, 0);
}
