import { z } from 'zod';
import { idSchema } from './common.js';

/**
 * Lookup tables of platforms and genres. They are global and pre-filled by the
 * seed, so a user does not end up creating their own "PS2" next to
 * "PlayStation 2" and the filters stay usable across the whole collection.
 */

export const platformSchema = z.object({
  id: idSchema,
  slug: z.string(),
  name: z.string(),
  /** Manufacturer, e.g. "Sony". */
  manufacturer: z.string().nullable(),
  /** Console generation (1-9); `null` for PC. */
  generation: z.number().int().nullable(),
  releaseYear: z.number().int().nullable(),
});
export type Platform = z.infer<typeof platformSchema>;

export const genreSchema = z.object({
  id: idSchema,
  slug: z.string(),
  name: z.string(),
});
export type Genre = z.infer<typeof genreSchema>;

export const catalogSchema = z.object({
  platforms: z.array(platformSchema),
  genres: z.array(genreSchema),
});
export type Catalog = z.infer<typeof catalogSchema>;
