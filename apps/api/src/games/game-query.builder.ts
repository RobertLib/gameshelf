import type { Prisma } from '@prisma/client';
import { normalizeText, type GameListQuery } from '@gameshelf/contracts';

/**
 * Translation of the contract filters into a Prisma query.
 *
 * It is a pure function with no dependency on Nest or on a database connection,
 * so it can be tested on its own - which matters quite a lot with the
 * combinatorics of fifteen filters.
 */
export function buildGameWhere(
  userId: string,
  query: GameListQuery,
): Prisma.GameWhereInput {
  const and: Prisma.GameWhereInput[] = [{ userId }];

  if (query.q) {
    /**
     * Every word has to be contained, and they need not be adjacent: "zelda
     * konami" finds "The Legend of Zelda" published by Konami even though the
     * two words sit in different fields.
     *
     * Only what `buildSearchIndex` puts into the column can be matched - the
     * platform name is not among it, so "zelda snes" finds nothing. Filtering
     * by platform is what `platformIds` is for.
     */
    for (const token of tokenize(query.q)) {
      and.push({ searchIndex: { contains: token } });
    }
  }

  if (query.platformIds?.length) {
    and.push({ platformId: { in: query.platformIds } });
  }

  if (query.genreIds?.length) {
    if (query.genreMatch === 'all') {
      // "Every selected genre" = one `some` per genre.
      for (const genreId of query.genreIds) {
        and.push({ genres: { some: { id: genreId } } });
      }
    } else {
      and.push({ genres: { some: { id: { in: query.genreIds } } } });
    }
  }

  if (query.regions?.length) and.push({ region: { in: query.regions } });
  if (query.conditions?.length)
    and.push({ condition: { in: query.conditions } });
  if (query.completeness?.length) {
    and.push({ completeness: { in: query.completeness } });
  }
  if (query.statuses?.length) and.push({ status: { in: query.statuses } });

  const releaseYear = rangeFilter(query.yearFrom, query.yearTo);
  if (releaseYear) and.push({ releaseYear });

  const rating = rangeFilter(query.ratingFrom, query.ratingTo);
  if (rating) and.push({ rating });

  const price = rangeFilter(
    query.priceFrom === undefined
      ? undefined
      : Math.round(query.priceFrom * 100),
    query.priceTo === undefined ? undefined : Math.round(query.priceTo * 100),
  );
  if (price) and.push({ purchasePriceMinor: price });

  if (query.developer) and.push({ developer: query.developer });
  if (query.publisher) and.push({ publisher: query.publisher });
  if (query.purchasedFrom) and.push({ purchasedFrom: query.purchasedFrom });
  if (query.storageLocation) {
    and.push({ storageLocation: query.storageLocation });
  }

  if (query.isFavorite !== undefined)
    and.push({ isFavorite: query.isFavorite });

  if (query.hasCover !== undefined) {
    and.push(
      query.hasCover
        ? { coverImageUrl: { not: null } }
        : { coverImageUrl: null },
    );
  }

  if (query.unrated !== undefined) {
    and.push(query.unrated ? { rating: null } : { rating: { not: null } });
  }

  return and.length === 1 ? and[0]! : { AND: and };
}

/**
 * Sorting. The title and the ID are always appended after the primary key -
 * without a stable tie-breaker, items with the same value (say all the unrated
 * ones) would be reshuffled between pages.
 */
export function buildGameOrderBy(
  query: GameListQuery,
): Prisma.GameOrderByWithRelationInput[] {
  const direction = query.order;

  const primary: Record<
    GameListQuery['sort'],
    Prisma.GameOrderByWithRelationInput
  > = {
    title: { sortTitle: direction },
    releaseYear: { releaseYear: direction },
    platform: { platform: { name: direction } },
    rating: { rating: direction },
    purchasePrice: { purchasePriceMinor: direction },
    condition: { conditionRank: direction },
    createdAt: { createdAt: direction },
    updatedAt: { updatedAt: direction },
  };

  const order: Prisma.GameOrderByWithRelationInput[] = [primary[query.sort]];
  if (query.sort !== 'title') order.push({ sortTitle: 'asc' });
  order.push({ id: 'asc' });

  return order;
}

/** Range filter; `undefined` when neither bound was given. */
function rangeFilter(
  from: number | undefined,
  to: number | undefined,
): Prisma.IntFilter | undefined {
  if (from === undefined && to === undefined) return undefined;
  return {
    ...(from !== undefined ? { gte: from } : {}),
    ...(to !== undefined ? { lte: to } : {}),
  };
}

/**
 * Splits the search term into normalized words. The `searchIndex` column went
 * through the same normalization on write, so an accent-free term matches an
 * accented title and the other way round.
 */
function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(' ')
    .filter((token) => token.length > 0)
    .slice(0, 8);
}
