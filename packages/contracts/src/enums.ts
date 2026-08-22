import { z } from 'zod';

/**
 * Domain enums of the collection.
 *
 * They are deliberately Zod enums over `string` rather than native DB enums -
 * that keeps the schema portable between SQLite and PostgreSQL, and adding a
 * new value is a change in one file instead of a database migration.
 */

/** Regional version of the physical medium. */
export const regionSchema = z.enum([
  'PAL',
  'NTSC_U',
  'NTSC_J',
  'REGION_FREE',
  'OTHER',
]);
export type Region = z.infer<typeof regionSchema>;

export const REGION_LABELS: Record<Region, string> = {
  PAL: 'PAL (Europe)',
  NTSC_U: 'NTSC-U (North America)',
  NTSC_J: 'NTSC-J (Japan)',
  REGION_FREE: 'Region free',
  OTHER: 'Other',
};

/**
 * A shortened region label for places without room for the full description
 * (tiles in the grid).
 *
 * It belongs here, not in the frontend: it is a domain label like any other,
 * and while it lived next to the badge color tuning it was the only piece of
 * text that reached the UI from outside the contracts.
 */
export const REGION_SHORT_LABELS: Record<Region, string> = {
  PAL: 'PAL',
  NTSC_U: 'NTSC-U',
  NTSC_J: 'NTSC-J',
  REGION_FREE: 'Region free',
  OTHER: 'Other',
};

/** Physical condition of the item. */
export const conditionSchema = z.enum([
  'MINT',
  'VERY_GOOD',
  'GOOD',
  'ACCEPTABLE',
  'POOR',
]);
export type Condition = z.infer<typeof conditionSchema>;

export const CONDITION_LABELS: Record<Condition, string> = {
  MINT: 'Mint',
  VERY_GOOD: 'Very good',
  GOOD: 'Good',
  ACCEPTABLE: 'Acceptable',
  POOR: 'Poor',
};

/**
 * Ordering for sorting by condition (best -> worst). The database sorts
 * `condition` as a string, so we need an explicit weight.
 */
export const CONDITION_RANK: Record<Condition, number> = {
  MINT: 5,
  VERY_GOOD: 4,
  GOOD: 3,
  ACCEPTABLE: 2,
  POOR: 1,
};

/** Completeness of the packaging - a key detail for collectors. */
export const completenessSchema = z.enum([
  'SEALED',
  'COMPLETE_IN_BOX',
  'BOXED_NO_MANUAL',
  'LOOSE',
  'MANUAL_ONLY',
  'BOX_ONLY',
]);
export type Completeness = z.infer<typeof completenessSchema>;

export const COMPLETENESS_LABELS: Record<Completeness, string> = {
  SEALED: 'Factory sealed',
  COMPLETE_IN_BOX: 'Complete in box (CIB)',
  BOXED_NO_MANUAL: 'Boxed without manual',
  LOOSE: 'Loose media',
  MANUAL_ONLY: 'Manual only',
  BOX_ONLY: 'Box only',
};

/** How far the game has been played. */
export const playStatusSchema = z.enum([
  'NOT_STARTED',
  'PLAYING',
  'COMPLETED',
  'ON_HOLD',
  'DROPPED',
]);
export type PlayStatus = z.infer<typeof playStatusSchema>;

export const PLAY_STATUS_LABELS: Record<PlayStatus, string> = {
  NOT_STARTED: 'Not started',
  PLAYING: 'Playing',
  COMPLETED: 'Completed',
  ON_HOLD: 'On hold',
  DROPPED: 'Dropped',
};

/** Currency of the purchase price. */
export const currencySchema = z.enum(['CZK', 'EUR', 'USD', 'GBP', 'PLN']);
export type Currency = z.infer<typeof currencySchema>;

export const CURRENCY_LABELS: Record<Currency, string> = {
  CZK: 'CZK',
  EUR: '€',
  USD: '$',
  GBP: '£',
  PLN: 'PLN',
};

/** The fields the collection can be sorted by. */
export const gameSortFieldSchema = z.enum([
  'title',
  'releaseYear',
  'platform',
  'rating',
  'purchasePrice',
  'condition',
  'createdAt',
  'updatedAt',
]);
export type GameSortField = z.infer<typeof gameSortFieldSchema>;

export const GAME_SORT_FIELD_LABELS: Record<GameSortField, string> = {
  title: 'Title',
  releaseYear: 'Release year',
  platform: 'Platform',
  rating: 'Rating',
  purchasePrice: 'Purchase price',
  condition: 'Condition',
  createdAt: 'Date added',
  updatedAt: 'Last updated',
};

export const sortOrderSchema = z.enum(['asc', 'desc']);
export type SortOrder = z.infer<typeof sortOrderSchema>;

/** Helper for rendering a `<select>` without copying the values by hand. */
export function optionsFrom<T extends string>(
  labels: Record<T, string>,
): ReadonlyArray<{ value: T; label: string }> {
  return (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
  }));
}
