import { z } from 'zod';

/**
 * Query parameters always arrive as strings (or arrays of strings for repeated
 * keys). These helpers convert them to real types before validation runs - and
 * because both the backend when reading and the frontend when building URLs use
 * them, the format of "what exactly is `?platformIds=`" cannot drift apart.
 */

const isEmpty = (v: unknown): boolean =>
  v === undefined ||
  v === null ||
  v === '' ||
  (Array.isArray(v) && v.length === 0);

/**
 * A comma-separated list of values or a repeated parameter.
 * Both `?regions=PAL,NTSC_U` and `?regions=PAL&regions=NTSC_U` yield
 * `['PAL','NTSC_U']`.
 */
export function csvOf<T extends z.ZodType>(item: T) {
  return z.preprocess((value) => {
    if (isEmpty(value)) return undefined;
    const raw = Array.isArray(value) ? value : [value];
    const parts = raw
      .flatMap((v) => String(v).split(','))
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
    return parts.length > 0 ? parts : undefined;
  }, z.array(item).optional());
}

/**
 * A number from the query string. An empty value passes through as `undefined`,
 * non-numeric text is passed on unchanged - let `z.number()` report the error
 * itself so the user gets a message about the type, not about a missing value.
 */
const numeric = (integer: boolean, options: { min?: number; max?: number }) => {
  let schema = integer ? z.number().int() : z.number();
  if (options.min !== undefined) schema = schema.min(options.min);
  if (options.max !== undefined) schema = schema.max(options.max);
  return schema;
};

const parseNumber = (value: unknown): unknown => {
  if (isEmpty(value)) return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? value : n;
};

/** Optional integer from the query string; an empty value means "not set". */
export function intParam(options: { min?: number; max?: number } = {}) {
  return z.preprocess(parseNumber, numeric(true, options).optional());
}

/** Optional decimal number from the query string. */
export function numberParam(options: { min?: number; max?: number } = {}) {
  return z.preprocess(parseNumber, numeric(false, options).optional());
}

/**
 * Optional boolean. `z.coerce.boolean()` would evaluate the string `"false"` as
 * `true` (a non-empty string), so we need our own conversion.
 */
export const boolParam = z.preprocess((value) => {
  if (isEmpty(value)) return undefined;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return value;
}, z.boolean().optional());

/** Optional non-empty string; trims whitespace and drops empty values. */
export function stringParam(maxLength = 200) {
  return z.preprocess((value) => {
    if (isEmpty(value)) return undefined;
    const s = String(value).trim();
    return s.length > 0 ? s : undefined;
  }, z.string().max(maxLength).optional());
}

/**
 * Serializes a filter object back into `URLSearchParams` in the format that
 * `csvOf` and friends understand. Used by the API client and by the
 * filters-to-URL synchronization alike.
 */
export function toSearchParams(
  input: Record<string, unknown>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (isEmpty(value)) continue;
    if (Array.isArray(value)) {
      params.set(key, value.join(','));
    } else if (typeof value === 'boolean') {
      params.set(key, value ? 'true' : 'false');
    } else {
      params.set(key, String(value));
    }
  }
  return params;
}

/**
 * A numeric parameter with a default value. `.default()` on its own is not
 * enough - it only reacts to `undefined`, whereas a URL delivers an empty
 * string.
 */
export function intParamWithDefault(
  defaultValue: number,
  options: { min?: number; max?: number } = {},
) {
  return z.preprocess(
    parseNumber,
    numeric(true, options).default(defaultValue),
  );
}

/**
 * Wraps an arbitrary schema so that an empty value from the URL becomes
 * `undefined`. Only in combination with `.default()` do default values work for
 * `?sort=` as well.
 */
export function optionalParam<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (isEmpty(value) ? undefined : value), schema);
}

/** Empty string/`undefined` -> `null`; otherwise the value unchanged. */
export const emptyToNull = (value: unknown): unknown => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

/** Like `emptyToNull`, but a numeric string is additionally cast to `number`. */
export const emptyToNullNumber = (value: unknown): unknown => {
  const v = emptyToNull(value);
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.'));
    return Number.isNaN(n) ? v : n;
  }
  return v;
};
