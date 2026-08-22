import { gameListQuerySchema, maxReleaseYear } from '@gameshelf/contracts';
import { buildGameOrderBy, buildGameWhere } from './game-query.builder';

/** Shortcut: the input goes through the same validation as a real query string. */
const parse = (input: Record<string, unknown>) =>
  gameListQuerySchema.parse(input);

describe('buildGameWhere', () => {
  const userId = 'user-1';

  it('scopes the query to the signed-in user even without other filters', () => {
    expect(buildGameWhere(userId, parse({}))).toEqual({ userId });
  });

  it('splits the search term into words and searches the normalized index', () => {
    const where = buildGameWhere(userId, parse({ q: 'Pokémon  RED' }));

    expect(where.AND).toEqual([
      { userId },
      { searchIndex: { contains: 'pokemon' } },
      { searchIndex: { contains: 'red' } },
    ]);
  });

  /**
   * Regression: `%` and `_` are SQL LIKE wildcards and Prisma does not escape
   * them inside `contains`. Without removing them, searching for "100%" would
   * match every game containing "100" - the user would smuggle a wildcard in
   * through an ordinary query.
   */
  it('keeps LIKE wildcards out of the query', () => {
    const where = buildGameWhere(userId, parse({ q: '100% final_fantasy' }));

    expect(where.AND).toEqual([
      { userId },
      { searchIndex: { contains: '100' } },
      { searchIndex: { contains: 'final' } },
      { searchIndex: { contains: 'fantasy' } },
    ]);
  });

  it('requires every genre separately with genreMatch=all', () => {
    const where = buildGameWhere(
      userId,
      parse({ genreIds: 'g1,g2', genreMatch: 'all' }),
    );

    expect(where.AND).toEqual([
      { userId },
      { genres: { some: { id: 'g1' } } },
      { genres: { some: { id: 'g2' } } },
    ]);
  });

  it('needs just one of the selected genres with genreMatch=any', () => {
    const where = buildGameWhere(userId, parse({ genreIds: 'g1,g2' }));

    expect(where.AND).toEqual([
      { userId },
      { genres: { some: { id: { in: ['g1', 'g2'] } } } },
    ]);
  });

  it('converts the price range into the smallest units of the currency', () => {
    const where = buildGameWhere(
      userId,
      parse({ priceFrom: '12.34', priceTo: '99.9' }),
    );

    expect(where.AND).toContainEqual({
      purchasePriceMinor: { gte: 1234, lte: 9990 },
    });
  });

  it('tells "without a cover" apart from "with a cover"', () => {
    expect(
      buildGameWhere(userId, parse({ hasCover: 'false' })).AND,
    ).toContainEqual({ coverImageUrl: null });
    expect(
      buildGameWhere(userId, parse({ hasCover: 'true' })).AND,
    ).toContainEqual({ coverImageUrl: { not: null } });
  });

  it('ignores empty values from the URL', () => {
    const where = buildGameWhere(
      userId,
      parse({ q: '', platformIds: '', regions: '', yearFrom: '' }),
    );

    expect(where).toEqual({ userId });
  });
});

describe('buildGameOrderBy', () => {
  it('sorts by the accent-free title and stabilizes the order by ID', () => {
    expect(buildGameOrderBy(parse({}))).toEqual([
      { sortTitle: 'asc' },
      { id: 'asc' },
    ]);
  });

  it('uses the numeric condition weight, not the alphabet of the constant name', () => {
    expect(
      buildGameOrderBy(parse({ sort: 'condition', order: 'desc' })),
    ).toEqual([{ conditionRank: 'desc' }, { sortTitle: 'asc' }, { id: 'asc' }]);
  });

  it('sorts by the platform name from the lookup table', () => {
    expect(buildGameOrderBy(parse({ sort: 'platform' }))[0]).toEqual({
      platform: { name: 'asc' },
    });
  });
});

/**
 * The filters are validated by the shared contract, so a nonsensical range is
 * rejected before any query is built. It is tested here because this is the file
 * that owns the translation of ranges into SQL - and the bug it guards against
 * was invisible: a reversed range used to validate happily and then honestly
 * return nothing, so the user could not tell a typo from an empty collection.
 */
describe('gameListQuerySchema ranges', () => {
  const issuePaths = (input: Record<string, unknown>) => {
    const result = gameListQuerySchema.safeParse(input);
    return result.success
      ? []
      : result.error.issues.map((issue) => issue.path.join('.'));
  };

  it.each([
    ['yearFrom', 'yearTo', 2000, 1990],
    ['ratingFrom', 'ratingTo', 8, 3],
    ['priceFrom', 'priceTo', 500, 100],
  ])('rejects a reversed %s/%s range', (from, to, high, low) => {
    expect(issuePaths({ [from]: high, [to]: low })).toEqual([to]);
  });

  it.each([
    ['yearFrom', 'yearTo', 1990, 2000],
    ['ratingFrom', 'ratingTo', 3, 8],
    ['priceFrom', 'priceTo', 100, 500],
  ])('accepts an ordered %s/%s range', (from, to, low, high) => {
    expect(issuePaths({ [from]: low, [to]: high })).toEqual([]);
  });

  /** Equal bounds are a single value, not a reversed range. */
  it('accepts a range collapsed to one value', () => {
    expect(issuePaths({ yearFrom: 1998, yearTo: 1998 })).toEqual([]);
  });

  /** One bound on its own is an open range and has nothing to contradict. */
  it('accepts a half-open range', () => {
    expect(issuePaths({ yearFrom: 2000 })).toEqual([]);
    expect(issuePaths({ ratingTo: 5 })).toEqual([]);
  });

  /**
   * The issue names the upper bound on purpose: `parseGameFilters` in the
   * frontend drops exactly the field an issue points at, so a hand-edited
   * address loses the stale ceiling and keeps the rest of the filter.
   */
  it('blames the upper bound so the frontend can recover from it', () => {
    const result = gameListQuerySchema.safeParse({
      q: 'zelda',
      yearFrom: 2010,
      yearTo: 1990,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path)).toEqual([['yearTo']]);
  });
});

/**
 * The year filter shares the ceiling with the write path, and for the same
 * reason it cannot be baked into `intParam` - that would freeze it when the
 * schema is built. Each issue names its own bound so `parseGameFilters` in the
 * frontend drops only the offending one and keeps the rest of the filter.
 */
describe('gameListQuerySchema year ceiling', () => {
  const issuePaths = (input: Record<string, unknown>) => {
    const result = gameListQuerySchema.safeParse(input);
    return result.success
      ? []
      : result.error.issues.map((issue) => issue.path.join('.'));
  };

  it('accepts the current ceiling on both ends', () => {
    expect(issuePaths({ yearFrom: 1990, yearTo: maxReleaseYear() })).toEqual(
      [],
    );
  });

  it('rejects a year above it and blames the field that carried it', () => {
    expect(issuePaths({ yearTo: maxReleaseYear() + 1 })).toEqual(['yearTo']);
    expect(issuePaths({ yearFrom: maxReleaseYear() + 1 })).toEqual([
      'yearFrom',
    ]);
  });
});
