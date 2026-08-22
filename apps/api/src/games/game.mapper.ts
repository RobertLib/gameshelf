import { Prisma } from '@prisma/client';
import {
  buildSearchIndex,
  toSortTitle,
  CONDITION_RANK,
  type Completeness,
  type Condition,
  type CreateGameInput,
  type Currency,
  type Game,
  type PlayStatus,
  type Region,
  type UpdateGameInput,
} from '@gameshelf/contracts';

/**
 * What has to be loaded so that a record can be translated into the contract's
 * `Game`. The derived `GameRecord` type keeps the mapper and the service in sync
 * with the queries.
 */
export const gameInclude = {
  platform: true,
  genres: true,
} satisfies Prisma.GameInclude;

export type GameRecord = Prisma.GameGetPayload<{ include: typeof gameInclude }>;

/**
 * Money is kept in the database in the smallest unit of the currency (cents).
 * If it were stored as a decimal number, the collection total would start
 * returning numbers like 12345.670000000002 after a few hundred items.
 */
export const toMinorUnits = (amount: number): number =>
  Math.round(amount * 100);
export const fromMinorUnits = (minor: number): number => minor / 100;

/** Database record -> the shape the contract promises. */
export function toGameDto(record: GameRecord): Game {
  return {
    id: record.id,
    title: record.title,
    platform: {
      id: record.platform.id,
      slug: record.platform.slug,
      name: record.platform.name,
      manufacturer: record.platform.manufacturer,
      generation: record.platform.generation,
      releaseYear: record.platform.releaseYear,
    },
    genres: [...record.genres]
      .sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'en'),
      )
      .map((genre) => ({ id: genre.id, slug: genre.slug, name: genre.name })),

    releaseYear: record.releaseYear,
    developer: record.developer,
    publisher: record.publisher,
    edition: record.edition,
    barcode: record.barcode,

    region: record.region as Region,
    condition: record.condition as Condition,
    completeness: record.completeness as Completeness,
    status: record.status as PlayStatus,

    quantity: record.quantity,
    isFavorite: record.isFavorite,
    rating: record.rating,

    coverImageUrl: record.coverImageUrl,

    purchasePrice:
      record.purchasePriceMinor === null
        ? null
        : fromMinorUnits(record.purchasePriceMinor),
    purchaseCurrency: record.purchaseCurrency as Currency,
    purchaseDate: record.purchaseDate,
    purchasedFrom: record.purchasedFrom,
    estimatedValue:
      record.estimatedValueMinor === null
        ? null
        : fromMinorUnits(record.estimatedValueMinor),

    storageLocation: record.storageLocation,
    notes: record.notes,

    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/**
 * Derived columns for sorting and searching.
 *
 * They are computed on every write from the current values - which is why they
 * need the complete picture of a game, not just the changed fields (see
 * `buildUpdateData`).
 */
export function derivedColumns(source: {
  title: string;
  developer: string | null;
  publisher: string | null;
  edition: string | null;
  barcode: string | null;
  notes: string | null;
  storageLocation: string | null;
  releaseYear: number | null;
  condition: Condition;
}): { sortTitle: string; searchIndex: string; conditionRank: number } {
  return {
    sortTitle: toSortTitle(source.title),
    searchIndex: buildSearchIndex([
      source.title,
      source.developer,
      source.publisher,
      source.edition,
      source.barcode,
      source.notes,
      source.storageLocation,
      source.releaseYear,
    ]),
    conditionRank: CONDITION_RANK[source.condition],
  };
}

/* ------------------------------------------------------------------ *
 * Contract -> table columns
 * ------------------------------------------------------------------ */

/**
 * The columns filled directly from contract fields.
 *
 * Not among them: `userId` (taken from the token), the derived columns
 * (`sortTitle`, `searchIndex`, `conditionRank`) and the genre relation - Prisma
 * handles that through `connect`/`set`, not by assigning to a column.
 */
type GameColumns = Omit<
  Prisma.GameUncheckedCreateInput,
  | 'id'
  | 'userId'
  | 'sortTitle'
  | 'searchIndex'
  | 'conditionRank'
  | 'createdAt'
  | 'updatedAt'
  | 'genres'
>;

/** The contract fields that map onto a column. Genres go through the relation. */
type WritableField = Exclude<keyof CreateGameInput, 'genreIds'>;

/**
 * Translation of a single contract field into columns.
 *
 * This is the only place where that translation is written down - and it is
 * enforced by the type: as soon as a field is added to `gameWriteShape`,
 * `Record<WritableField, …>` stops compiling until it is added here too. While
 * `create` and `update` were assembled separately (and update on top of that in
 * twenty-two lines of `if (input.x !== undefined) data.x = input.x`), a new
 * field could silently fall out of one of the two paths and nothing would catch
 * it: the form would send it, the API would accept it and the response would
 * look right, because it is recomputed from the same input.
 */
const COLUMN_MAP: {
  [K in WritableField]: (value: CreateGameInput[K]) => Partial<GameColumns>;
} = {
  title: (value) => ({ title: value }),
  platformId: (value) => ({ platformId: value }),

  releaseYear: (value) => ({ releaseYear: value }),
  developer: (value) => ({ developer: value }),
  publisher: (value) => ({ publisher: value }),
  edition: (value) => ({ edition: value }),
  barcode: (value) => ({ barcode: value }),

  region: (value) => ({ region: value }),
  condition: (value) => ({ condition: value }),
  completeness: (value) => ({ completeness: value }),
  status: (value) => ({ status: value }),

  quantity: (value) => ({ quantity: value }),
  isFavorite: (value) => ({ isFavorite: value }),
  rating: (value) => ({ rating: value }),

  coverImageUrl: (value) => ({ coverImageUrl: value }),

  purchasePrice: (value) => ({
    purchasePriceMinor: value === null ? null : toMinorUnits(value),
  }),
  purchaseCurrency: (value) => ({ purchaseCurrency: value }),
  purchaseDate: (value) => ({ purchaseDate: value }),
  purchasedFrom: (value) => ({ purchasedFrom: value }),
  estimatedValue: (value) => ({
    estimatedValueMinor: value === null ? null : toMinorUnits(value),
  }),

  storageLocation: (value) => ({ storageLocation: value }),
  notes: (value) => ({ notes: value }),
};

const WRITABLE_FIELDS = Object.keys(COLUMN_MAP) as WritableField[];

/**
 * Walks the submitted fields and assembles columns from them. An absent field
 * (`undefined`) is skipped, so a PATCH yields only what really should change; an
 * explicit `null`, on the other hand, goes through and clears the value.
 */
function toColumns(input: Partial<CreateGameInput>): Partial<GameColumns> {
  const columns: Partial<GameColumns> = {};

  for (const field of WRITABLE_FIELDS) {
    const value = input[field];
    if (value === undefined) continue;
    Object.assign(
      columns,
      (COLUMN_MAP[field] as (v: unknown) => Partial<GameColumns>)(value),
    );
  }

  return columns;
}

/** Input from the API -> data for `prisma.game.create`. */
export function buildCreateData(
  userId: string,
  input: CreateGameInput,
): Prisma.GameUncheckedCreateInput & { genres?: never } {
  return {
    userId,
    ...derivedColumns(input),
    /**
     * After validation `CreateGameInput` has every field filled in - for the
     * enums that is ensured by `.default()`, for the optional texts by
     * `emptyToNull` in `z.preprocess`. `toColumns` therefore returns the complete
     * set of columns; the type cannot infer that on its own, hence the
     * assertion. That nothing is actually missing is guarded by the
     * `buildCreateData` test in `game.mapper.spec.ts`.
     */
    ...(toColumns(input) as GameColumns),
  };
}

/**
 * Input from a PATCH -> data for `prisma.game.update`.
 *
 * `current` is the existing state; it is used to recompute the derived columns,
 * because changing the publisher alone has to update the search index too.
 */
export function buildUpdateData(
  current: GameRecord,
  input: UpdateGameInput,
): Prisma.GameUncheckedUpdateInput {
  const pick = <K extends keyof UpdateGameInput, T>(
    key: K,
    fallback: T,
  ): NonNullable<UpdateGameInput[K]> | T =>
    input[key] !== undefined ? input[key] : fallback;

  const merged = {
    title: pick('title', current.title),
    developer: pick('developer', current.developer),
    publisher: pick('publisher', current.publisher),
    edition: pick('edition', current.edition),
    barcode: pick('barcode', current.barcode),
    notes: pick('notes', current.notes),
    storageLocation: pick('storageLocation', current.storageLocation),
    releaseYear: pick('releaseYear', current.releaseYear),
    condition: pick('condition', current.condition as Condition),
  };

  return {
    ...derivedColumns(merged),
    ...toColumns(input),
  };
}

/** Only for the map-completeness test - the application code makes do with `toColumns`. */
export const writableFields: ReadonlyArray<WritableField> = WRITABLE_FIELDS;
