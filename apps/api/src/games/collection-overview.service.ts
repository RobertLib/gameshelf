import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  COMPLETENESS_LABELS,
  CONDITION_LABELS,
  PLAY_STATUS_LABELS,
  REGION_LABELS,
  type CollectionOverview,
  type Currency,
  type FacetBucket,
} from '@gameshelf/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { fromMinorUnits } from './game.mapper';

/** How many distinct values to offer for free-text fields (storage, publisher…). */
const FREE_TEXT_FACET_LIMIT = 30;

/**
 * The columns the collection is broken down by into filter choices.
 *
 * The union is not decoration: it holds `countBy` below together so that the
 * breakdown can be written once instead of nine times and a typo in a column
 * name does not compile.
 */
type FacetField =
  | 'platformId'
  | 'region'
  | 'condition'
  | 'completeness'
  | 'status'
  | 'storageLocation'
  | 'developer'
  | 'publisher'
  | 'purchasedFrom'
  | 'purchaseCurrency';

/** One row of the breakdown: the column value and how many games have it. */
type FacetRow<F extends FacetField> = Record<F, string | null> & {
  _count: { _all: number };
};

/**
 * The basis for the filter panel and the dashboard.
 *
 * The filters are not built from a fixed list but from what the user actually
 * owns - somebody who collects only PlayStation does not get twenty consoles
 * they do not own in the picker. Every choice also carries a count, so it is
 * visible up front what the filter will do.
 */
@Injectable()
export class CollectionOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(userId: string): Promise<CollectionOverview> {
    const where = { userId };
    /** A value filled in for only part of the collection - empty rows do not belong in the picker. */
    const filled = (field: FacetField): Prisma.GameWhereInput => ({
      ...where,
      [field]: { not: null },
    });

    /**
     * The queries run in parallel but not in a transaction: `groupBy` inside
     * `$transaction([...])` loses the type inference of `by`, and the overview is
     * read-only, where a small inconsistency between partial queries does no harm.
     */
    const [totals, favoriteCount, completedCount, pricedGamesCount] =
      await Promise.all([
        this.prisma.game.aggregate({
          where,
          _count: { _all: true },
          _sum: {
            quantity: true,
            purchasePriceMinor: true,
            estimatedValueMinor: true,
          },
          _avg: { rating: true },
          _min: { releaseYear: true },
          _max: { releaseYear: true },
        }),
        this.prisma.game.count({ where: { ...where, isFavorite: true } }),
        this.prisma.game.count({ where: { ...where, status: 'COMPLETED' } }),
        this.prisma.game.count({
          where: { ...where, purchasePriceMinor: { not: null } },
        }),
      ]);

    const [
      byPlatform,
      byRegion,
      byCondition,
      byCompleteness,
      byStatus,
      byStorage,
      byDeveloper,
      byPublisher,
      byPurchasedFrom,
      byCurrency,
    ] = await Promise.all([
      this.countBy('platformId', where),
      this.countBy('region', where),
      this.countBy('condition', where),
      this.countBy('completeness', where),
      this.countBy('status', where),
      this.countBy('storageLocation', filled('storageLocation'), {
        take: FREE_TEXT_FACET_LIMIT,
      }),
      this.countBy('developer', filled('developer'), {
        take: FREE_TEXT_FACET_LIMIT,
      }),
      this.countBy('publisher', filled('publisher'), {
        take: FREE_TEXT_FACET_LIMIT,
      }),
      this.countBy('purchasedFrom', filled('purchasedFrom'), {
        take: FREE_TEXT_FACET_LIMIT,
      }),
      this.countBy('purchaseCurrency', {
        ...where,
        OR: [
          { purchasePriceMinor: { not: null } },
          { estimatedValueMinor: { not: null } },
        ],
      }),
    ]);

    const platformIds = byPlatform.flatMap((row) =>
      row.platformId === null ? [] : [row.platformId],
    );
    const platforms = await this.prisma.platform.findMany({
      where: { id: { in: platformIds } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const platformCounts = new Map(
      byPlatform.map((row) => [row.platformId, row._count._all]),
    );

    const genres = await this.prisma.genre.findMany({
      where: { games: { some: { userId } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        _count: { select: { games: { where: { userId } } } },
      },
    });

    /**
     * Price totals only make sense when the whole collection is in one currency.
     * Mixing dollars with euros without exchange rates would give a number that
     * means nothing.
     *
     * The currency is looked up across games with a purchase price **and** an
     * estimated value. Anyone who fills in estimates only used to see a dash for
     * the collection value even though it could be computed - the single currency
     * used to be determined from purchase prices alone.
     */
    const singleCurrency: Currency | null =
      byCurrency.length === 1
        ? ((byCurrency[0]?.purchaseCurrency ?? null) as Currency | null)
        : null;

    return {
      stats: {
        totalGames: totals._count._all,
        totalCopies: totals._sum.quantity ?? 0,
        totalPlatforms: platformIds.length,
        totalPurchaseValue:
          singleCurrency && totals._sum.purchasePriceMinor !== null
            ? fromMinorUnits(totals._sum.purchasePriceMinor)
            : null,
        totalEstimatedValue:
          singleCurrency && totals._sum.estimatedValueMinor !== null
            ? fromMinorUnits(totals._sum.estimatedValueMinor)
            : null,
        valueCurrency: singleCurrency,
        pricedGamesCount,
        averageRating:
          totals._avg.rating === null
            ? null
            : Math.round(totals._avg.rating * 10) / 10,
        completedCount,
        favoriteCount,
        oldestReleaseYear: totals._min.releaseYear,
        newestReleaseYear: totals._max.releaseYear,
      },
      facets: {
        platforms: platforms.map((platform) => ({
          value: platform.id,
          label: platform.name,
          count: platformCounts.get(platform.id) ?? 0,
        })),
        genres: genres.map((genre) => ({
          value: genre.id,
          label: genre.name,
          count: genre._count.games,
        })),
        regions: labelledFacets(byRegion, 'region', REGION_LABELS),
        conditions: labelledFacets(byCondition, 'condition', CONDITION_LABELS),
        completeness: labelledFacets(
          byCompleteness,
          'completeness',
          COMPLETENESS_LABELS,
        ),
        statuses: labelledFacets(byStatus, 'status', PLAY_STATUS_LABELS),
        storageLocations: freeTextFacets(byStorage, 'storageLocation'),
        developers: freeTextFacets(byDeveloper, 'developer'),
        publishers: freeTextFacets(byPublisher, 'publisher'),
        purchasedFrom: freeTextFacets(byPurchasedFrom, 'purchasedFrom'),
      },
    };
  }

  /**
   * Breakdown of the collection by a single column.
   *
   * There used to be nine almost identical `groupBy` blocks here that differed
   * only in the column name - and for free texts they additionally pulled every
   * distinct value out of the database only to trim it to thirty in JavaScript.
   * `take` sends that limit where it belongs: into the query.
   */
  private countBy<F extends FacetField>(
    field: F,
    where: Prisma.GameWhereInput,
    options: { take?: number } = {},
  ): Promise<Array<FacetRow<F>>> {
    /**
     * The only assertion in the whole breakdown - and it is forced by Prisma, not
     * by sloppiness. `groupBy` describes both `by` and `orderBy` with conditional
     * types that are evaluated over a *literal* list of columns. Over the type
     * variable `F` the compiler cannot verify them and rejects even an obviously
     * valid query (the same loss of inference as with `groupBy` inside
     * `$transaction`). The shape of the result is guarded by `FacetRow<F>` and by
     * `toBuckets` below.
     */
    const games = this.prisma.game as unknown as {
      groupBy(args: {
        by: [F];
        where: Prisma.GameWhereInput;
        _count: { _all: true };
        orderBy: Record<string, unknown>;
        take?: number;
      }): Promise<Array<FacetRow<F>>>;
    };

    return games.groupBy({
      by: [field],
      where,
      _count: { _all: true },
      // Sorting is required so that `take` picks the most frequent ones rather
      // than a random thirty.
      orderBy: { _count: { [field]: 'desc' } },
      ...(options.take !== undefined ? { take: options.take } : {}),
    });
  }
}

/**
 * Breakdown rows into filter choices. An unfilled value (`null`) is skipped -
 * "no publisher" is not a publisher one could tick in the panel.
 */
function toBuckets<F extends FacetField>(
  rows: Array<FacetRow<F>>,
  field: F,
  label: (value: string) => string,
): FacetBucket[] {
  return rows.flatMap((row) => {
    const value = row[field];
    return value === null
      ? []
      : [{ value, label: label(value), count: row._count._all }];
  });
}

/** Enum values sorted by their order in the lookup table, with a human-readable label. */
function labelledFacets<F extends FacetField>(
  rows: Array<FacetRow<F>>,
  field: F,
  labels: Record<string, string>,
): FacetBucket[] {
  const order = Object.keys(labels);

  return toBuckets(rows, field, (value) => labels[value] ?? value).sort(
    (a, b) => order.indexOf(a.value) - order.indexOf(b.value),
  );
}

/** Free text sorted by frequency; the label is the value itself. */
function freeTextFacets<F extends FacetField>(
  rows: Array<FacetRow<F>>,
  field: F,
): FacetBucket[] {
  return toBuckets(rows, field, (value) => value).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'en'),
  );
}
