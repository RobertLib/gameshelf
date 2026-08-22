import { z } from 'zod';

/** Entity identifier (cuid2 from Prisma). */
export const idSchema = z.string().min(1).max(64);

/** Empty response body for operations such as DELETE/logout. */
export const okSchema = z.object({ ok: z.literal(true) });
export type Ok = z.infer<typeof okSchema>;

/**
 * The uniform error envelope. The backend returns it from the global exception
 * filter and the frontend parses it in the API client - so the shape of an
 * error is part of the contract too, not just a happy accident.
 */
export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  /** Machine-readable code, e.g. `VALIDATION_FAILED`, `EMAIL_TAKEN`. */
  code: z.string(),
  /** Human-readable message. */
  message: z.string(),
  /** Per-field form errors: `{ "title": ["This field is required"] }`. */
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  path: z.string().optional(),
  timestamp: z.string().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/** Pagination metadata in a response. */
export const pageMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  totalItems: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasPrevious: z.boolean(),
  hasNext: z.boolean(),
});
export type PageMeta = z.infer<typeof pageMetaSchema>;

/** Generic paginated result. */
export function paginated<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    meta: pageMetaSchema,
  });
}

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 100;
