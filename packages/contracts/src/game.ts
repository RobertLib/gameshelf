import { z } from 'zod';
import {
  idSchema,
  paginated,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from './common.js';
import { genreSchema, platformSchema } from './catalog.js';
import {
  completenessSchema,
  conditionSchema,
  currencySchema,
  gameSortFieldSchema,
  playStatusSchema,
  regionSchema,
  sortOrderSchema,
  type Completeness,
  type Condition,
  type Currency,
  type PlayStatus,
  type Region,
} from './enums.js';
import {
  boolParam,
  csvOf,
  emptyToNull,
  emptyToNullNumber,
  intParam,
  intParamWithDefault,
  numberParam,
  optionalParam,
  stringParam,
} from './query.js';

/** The earliest release year that makes sense for a video game. */
export const MIN_RELEASE_YEAR = 1970;

/**
 * The latest release year that can be entered: three years ahead, so an
 * announced title fits too.
 *
 * It is a function for exactly the same reason as `latestPurchaseDate` below. A
 * constant would be evaluated when the module loads, and this module is loaded
 * in two very different places: a server process that runs for weeks would keep
 * offering last year's ceiling after New Year's Eve, and the browser bundle
 * would freeze it at *build* time, so the form could refuse a year the API
 * happily accepts.
 */
export function maxReleaseYear(): number {
  return new Date().getUTCFullYear() + 3;
}

/** No physical game can have been bought before this. */
export const MIN_PURCHASE_DATE = '1970-01-01';

/**
 * The latest date something can have been bought on: today.
 *
 * It is a function, not a constant. A constant would be evaluated when the
 * module loads, so a server running for a week would refuse today's date - and
 * the bug would only appear after midnight in a long-lived process.
 *
 * The day of slack is for time zones: the browser offers the user *their* today,
 * which east of UTC is already tomorrow in UTC terms. Without the slack, users
 * in Asia and Oceania could not enter a purchase made today.
 */
function latestPurchaseDate(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Optional text: an empty form input is `null`, not `""`.
 * Without this, empty strings and NULLs would live side by side in the database.
 */
const nullableString = (max: number, message?: string) =>
  z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .max(max, { message: message ?? `At most ${max} characters.` })
      .nullable(),
  );

const nullableInt = (min: number, max: number, message: string) =>
  z.preprocess(
    emptyToNullNumber,
    z.number().int().min(min, { message }).max(max, { message }).nullable(),
  );

const nullableMoney = (message: string) =>
  z.preprocess(
    emptyToNullNumber,
    z.number().min(0, { message }).max(10_000_000, { message }).nullable(),
  );

/**
 * Cover image - either a relative path into our `/uploads`, or an external URL.
 * Anything longer than 2048 characters is rejected so a data URI cannot be
 * pasted into the column.
 */
const coverImageUrlSchema = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .max(2048, { message: 'The image address is too long.' })
    .refine((v) => v.startsWith('/uploads/') || /^https?:\/\//i.test(v), {
      message:
        'It must be an uploaded file or an address starting with http(s)://.',
    })
    .nullable(),
);

/* ------------------------------------------------------------------ *
 * Write
 * ------------------------------------------------------------------ */

/**
 * Default values of a new record.
 *
 * They live here as plain data rather than only inside `.default()`, because
 * the frontend needs them too: the new-game form has to pre-fill exactly what
 * the server would otherwise supply. As long as each side kept its own copy,
 * the default region in the UI could drift from what the API stores and nobody
 * would notice - a filled-in value always makes it into the request body.
 */
export const GAME_CREATE_DEFAULTS = {
  genreIds: [],
  region: 'PAL',
  condition: 'GOOD',
  completeness: 'COMPLETE_IN_BOX',
  status: 'NOT_STARTED',
  quantity: 1,
  isFavorite: false,
  purchaseCurrency: 'CZK',
} as const satisfies {
  genreIds: readonly string[];
  region: Region;
  condition: Condition;
  completeness: Completeness;
  status: PlayStatus;
  quantity: number;
  isFavorite: boolean;
  purchaseCurrency: Currency;
};

/**
 * The write fields **without default values**.
 *
 * This is the basis for both POST and PATCH, and the split is essential:
 * `.default()` is not removed by `.partial()`. If the defaults hung directly
 * here, a `PATCH` with the body `{ isFavorite: true }` would after validation
 * also contain `region: 'PAL'`, `condition: 'GOOD'` and `genreIds: []` - and the
 * service layer, which tells "not sent" apart by `undefined`, would dutifully
 * write them. A single click on the heart would then wipe the game's genres and
 * reset both its status and its completeness.
 *
 * The defaults are therefore added further down by `createGameSchema`. The
 * exception are fields wrapped in `z.preprocess` (such as `quantity`) - there
 * `.default()` sits inside a pipe that `.partial()` does not run at all when the
 * key is missing, so nothing can leak through.
 */
const gameWriteShape = {
  title: z
    .string()
    .trim()
    .min(1, { message: 'The title is required.' })
    .max(200, { message: 'The title may be at most 200 characters long.' }),
  platformId: idSchema.describe('Platform ID from the lookup table'),
  /** Duplicates are removed right here so the service never sees `['a','a']`. */
  genreIds: z
    .array(idSchema)
    .max(10, { message: 'At most 10 genres.' })
    .transform((ids) => [...new Set(ids)]),

  /**
   * The ceiling is read when the value is validated, not when the schema is
   * built - see `maxReleaseYear`. The message is a function for the same
   * reason: baked in at construction time it would name a year the check no
   * longer uses.
   */
  releaseYear: z.preprocess(
    emptyToNullNumber,
    z
      .number()
      .int()
      .nullable()
      .refine(
        (value) =>
          value === null ||
          (value >= MIN_RELEASE_YEAR && value <= maxReleaseYear()),
        {
          error: () =>
            `The release year must be between ${MIN_RELEASE_YEAR} and ${maxReleaseYear()}.`,
        },
      ),
  ),
  developer: nullableString(120),
  publisher: nullableString(120),
  edition: nullableString(120).describe(
    'e.g. "Platinum", "Collector’s Edition"',
  ),
  barcode: nullableString(32),

  region: regionSchema,
  condition: conditionSchema,
  completeness: completenessSchema,
  status: playStatusSchema,

  quantity: z.preprocess(
    (v) =>
      v === '' || v === null || v === undefined
        ? GAME_CREATE_DEFAULTS.quantity
        : Number(v),
    z
      .number()
      .int()
      .min(1, { message: 'At least 1 copy.' })
      .max(999, { message: 'At most 999 copies.' })
      .default(GAME_CREATE_DEFAULTS.quantity),
  ),
  isFavorite: z.boolean(),
  rating: nullableInt(1, 10, 'The rating must be between 1 and 10.'),

  coverImageUrl: coverImageUrlSchema,

  purchasePrice: nullableMoney('The price must be a positive number.'),
  purchaseCurrency: currencySchema,
  /**
   * The date is bounded on both sides. `z.iso.date()` on its own only checks the
   * format, so a typo in the year (9999, or 202 instead of 2024) used to be
   * stored happily - and then sorted the game to one end of the list forever.
   */
  purchaseDate: z.preprocess(
    emptyToNull,
    z.iso
      .date({ message: 'Invalid date.' })
      .refine(
        (value) => value >= MIN_PURCHASE_DATE && value <= latestPurchaseDate(),
        { message: 'The purchase date must be between 1970 and today.' },
      )
      .nullable(),
  ),
  purchasedFrom: nullableString(120).describe(
    'Second-hand shop, auction site, a specific seller…',
  ),
  estimatedValue: nullableMoney('The estimate must be a positive number.'),

  storageLocation: nullableString(120).describe(
    'Where the game physically lives',
  ),
  notes: nullableString(4000),
};

/** POST - fields left empty get a sensible default value. */
export const createGameSchema = z.object(gameWriteShape).extend({
  genreIds: gameWriteShape.genreIds.default([...GAME_CREATE_DEFAULTS.genreIds]),
  region: regionSchema.default(GAME_CREATE_DEFAULTS.region),
  condition: conditionSchema.default(GAME_CREATE_DEFAULTS.condition),
  completeness: completenessSchema.default(GAME_CREATE_DEFAULTS.completeness),
  status: playStatusSchema.default(GAME_CREATE_DEFAULTS.status),
  isFavorite: z.boolean().default(GAME_CREATE_DEFAULTS.isFavorite),
  purchaseCurrency: currencySchema.default(
    GAME_CREATE_DEFAULTS.purchaseCurrency,
  ),
});
export type CreateGameInput = z.infer<typeof createGameSchema>;

/** PATCH - an omitted field means "leave unchanged", no defaults are filled in. */
export const updateGameSchema = z.object(gameWriteShape).partial();
export type UpdateGameInput = z.infer<typeof updateGameSchema>;

/* ------------------------------------------------------------------ *
 * Read
 * ------------------------------------------------------------------ */

export const gameSchema = z.object({
  id: idSchema,
  title: z.string(),
  platform: platformSchema,
  genres: z.array(genreSchema),

  releaseYear: z.number().int().nullable(),
  developer: z.string().nullable(),
  publisher: z.string().nullable(),
  edition: z.string().nullable(),
  barcode: z.string().nullable(),

  region: regionSchema,
  condition: conditionSchema,
  completeness: completenessSchema,
  status: playStatusSchema,

  quantity: z.number().int(),
  isFavorite: z.boolean(),
  rating: z.number().int().nullable(),

  coverImageUrl: z.string().nullable(),

  purchasePrice: z.number().nullable(),
  purchaseCurrency: currencySchema,
  purchaseDate: z.iso.date().nullable(),
  purchasedFrom: z.string().nullable(),
  estimatedValue: z.number().nullable(),

  storageLocation: z.string().nullable(),
  notes: z.string().nullable(),

  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Game = z.infer<typeof gameSchema>;

export const gameListSchema = paginated(gameSchema);
export type GameList = z.infer<typeof gameListSchema>;

/* ------------------------------------------------------------------ *
 * Filtering and sorting
 * ------------------------------------------------------------------ */

/**
 * The complete set of list filters. Everything is optional and tolerant of
 * empty values from the URL, so the same object can serve as the state of the
 * filter panel, as a query string and as the service-layer input.
 */
/**
 * The `*From` / `*To` pairs, so the check below is written once instead of three
 * times. The tuple is `[lower bound, upper bound, what it is]`.
 */
const RANGE_PAIRS = [
  ['yearFrom', 'yearTo', 'release year'],
  ['ratingFrom', 'ratingTo', 'rating'],
  ['priceFrom', 'priceTo', 'purchase price'],
] as const satisfies ReadonlyArray<readonly [string, string, string]>;

export const gameListQuerySchema = z
  .object({
    /**
     * Full text over the `searchIndex` column, which holds the title, the
     * developer, the publisher, the edition, the barcode, the notes, the
     * storage location and the release year (see `buildSearchIndex`). The
     * platform is deliberately not in it - it is filtered by `platformIds`.
     */
    q: stringParam(200),

    platformIds: csvOf(idSchema),
    genreIds: csvOf(idSchema),
    /** `all` = the game must have every selected genre, `any` = at least one. */
    genreMatch: optionalParam(z.enum(['any', 'all']).default('any')),

    regions: csvOf(regionSchema),
    conditions: csvOf(conditionSchema),
    completeness: csvOf(completenessSchema),
    statuses: csvOf(playStatusSchema),

    /** The upper bound is checked in `superRefine` below - it moves with time. */
    yearFrom: intParam({ min: MIN_RELEASE_YEAR }),
    yearTo: intParam({ min: MIN_RELEASE_YEAR }),
    ratingFrom: intParam({ min: 1, max: 10 }),
    ratingTo: intParam({ min: 1, max: 10 }),
    priceFrom: numberParam({ min: 0 }),
    priceTo: numberParam({ min: 0 }),

    developer: stringParam(120),
    publisher: stringParam(120),
    purchasedFrom: stringParam(120),
    storageLocation: stringParam(120),

    isFavorite: boolParam,
    /** `true` = only games with a cover, `false` = only games without one. */
    hasCover: boolParam,
    /** `true` = only unrated copies (handy when filling in the collection). */
    unrated: boolParam,

    sort: optionalParam(gameSortFieldSchema.default('title')),
    order: optionalParam(sortOrderSchema.default('asc')),
    page: intParamWithDefault(1, { min: 1, max: 100_000 }),
    pageSize: intParamWithDefault(DEFAULT_PAGE_SIZE, {
      min: 1,
      max: MAX_PAGE_SIZE,
    }),
  })
  /**
   * A reversed range is an error, not an empty collection.
   *
   * `?yearFrom=2000&yearTo=1990` used to pass validation and then honestly
   * return zero games - so the user saw "Nothing matches the filter" and had no
   * way of telling a badly typed year from a genuinely empty selection.
   *
   * The issue is deliberately reported on the **upper** bound. The filter panel
   * cannot produce such a pair at all (`RangeInputs` keeps the two ends
   * coherent), so this only fires on a hand-edited or copied address - and there
   * `parseGameFilters` in the frontend drops exactly the field the issue names
   * and keeps the rest of the filter. Naming the lower bound would throw away
   * the value the user is more likely to have meant.
   */
  .superRefine((query, ctx) => {
    for (const [fromKey, toKey, label] of RANGE_PAIRS) {
      const from = query[fromKey];
      const to = query[toKey];
      if (from === undefined || to === undefined || from <= to) continue;

      ctx.addIssue({
        code: 'custom',
        path: [toKey],
        message: `The ${label} range is reversed - the upper bound must not be below the lower one.`,
      });
    }

    /**
     * The year ceiling belongs here rather than in `intParam`, because that one
     * would freeze it when the schema is built (see `maxReleaseYear`). Both
     * ends are checked, and each issue names its own field so
     * `parseGameFilters` in the frontend drops only the offending bound.
     */
    const ceiling = maxReleaseYear();
    for (const key of ['yearFrom', 'yearTo'] as const) {
      const value = query[key];
      if (value === undefined || value <= ceiling) continue;

      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `The release year must not be above ${ceiling}.`,
      });
    }
  });
export type GameListQuery = z.infer<typeof gameListQuerySchema>;
/** The shape usable for UI state / links (everything optional). */
export type GameListQueryInput = z.input<typeof gameListQuerySchema>;

/* ------------------------------------------------------------------ *
 * Collection overview (the basis for both filters and the dashboard)
 * ------------------------------------------------------------------ */

const facetBucketSchema = z.object({
  value: z.string(),
  label: z.string(),
  count: z.number().int().min(0),
});
export type FacetBucket = z.infer<typeof facetBucketSchema>;

export const collectionOverviewSchema = z.object({
  stats: z.object({
    /** Number of records (titles). */
    totalGames: z.number().int(),
    /** Sum of `quantity` - how many physical copies the collection holds. */
    totalCopies: z.number().int(),
    totalPlatforms: z.number().int(),
    /** Sum of purchase prices; only if the whole collection uses one currency. */
    totalPurchaseValue: z.number().nullable(),
    totalEstimatedValue: z.number().nullable(),
    /** Currency of the totals, `null` if the collection mixes currencies. */
    valueCurrency: currencySchema.nullable(),
    /**
     * How many games have a purchase price filled in. It tells "nobody entered
     * any prices" apart from "the prices use several currencies and therefore
     * cannot be summed" - in both cases `totalPurchaseValue` is empty.
     */
    pricedGamesCount: z.number().int(),
    averageRating: z.number().nullable(),
    completedCount: z.number().int(),
    favoriteCount: z.number().int(),
    oldestReleaseYear: z.number().int().nullable(),
    newestReleaseYear: z.number().int().nullable(),
  }),
  /** Choices for the filter panel, already with counts and without empty options. */
  facets: z.object({
    platforms: z.array(facetBucketSchema),
    genres: z.array(facetBucketSchema),
    regions: z.array(facetBucketSchema),
    conditions: z.array(facetBucketSchema),
    completeness: z.array(facetBucketSchema),
    statuses: z.array(facetBucketSchema),
    storageLocations: z.array(facetBucketSchema),
    developers: z.array(facetBucketSchema),
    publishers: z.array(facetBucketSchema),
    purchasedFrom: z.array(facetBucketSchema),
  }),
});
export type CollectionOverview = z.infer<typeof collectionOverviewSchema>;

/* ------------------------------------------------------------------ *
 * Cover upload
 * ------------------------------------------------------------------ */

export const uploadResultSchema = z.object({
  /** Relative address that can be stored straight into `coverImageUrl`. */
  url: z.string(),
  fileName: z.string(),
  sizeBytes: z.number().int(),
  mimeType: z.string(),
});
export type UploadResult = z.infer<typeof uploadResultSchema>;

export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
] as const;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Name of the `multipart/form-data` field the file is sent under. */
export const UPLOAD_FIELD_NAME = 'file';
