/**
 * Text normalization shared by the backend and the frontend.
 *
 * The backend uses it on write (filling `sortTitle` and `searchIndex`), the
 * frontend on query (normalizing the search term). If each side had its own
 * implementation, searching for "pokemon" would stop finding "Pokemon" the
 * moment one of them changed.
 */

/** Combining diacritical marks left over after decomposing into NFD. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * SQL LIKE wildcards.
 *
 * Full-text search is `LIKE '%term%'` over the `searchIndex` column, and Prisma
 * does not escape the contents of `contains` (for SQLite it does not even offer
 * `ESCAPE`). Searching for "100%" would therefore match every game containing
 * "100", and "final_fantasy" would also match "finalXfantasy" - the user would
 * smuggle a wildcard into the query through an ordinary search.
 *
 * It is handled here rather than in the query translation so that both sides
 * stay symmetric: both the stored index and the search term go through this
 * function. Wildcards are replaced by a space, not by nothing, so
 * "final_fantasy" becomes two words and searching keeps working.
 */
const LIKE_WILDCARDS = /[%_]/g;

/** Lower case without diacritics - the basis for both searching and sorting. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(LIKE_WILDCARDS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const LEADING_ARTICLES = ['the ', 'a ', 'an '] as const;

/**
 * The key for alphabetical sorting: "The Legend of Zelda" sorts under "L", not
 * under "T".
 */
export function toSortTitle(title: string): string {
  const normalized = normalizeText(title);
  const article = LEADING_ARTICLES.find((a) => normalized.startsWith(a));
  return article ? normalized.slice(article.length) : normalized;
}

/**
 * Merges all searchable fields of a game into a single normalized string. It is
 * stored in the `searchIndex` column, so full-text search is a single `LIKE`
 * across the title, developer, publisher, barcode and notes.
 */
export function buildSearchIndex(
  parts: ReadonlyArray<string | number | null | undefined>,
): string {
  return normalizeText(
    parts
      .filter(
        (p): p is string | number => p !== null && p !== undefined && p !== '',
      )
      .join(' '),
  );
}

/** Safe slug creation (for platforms and genres in the seed). */
export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
