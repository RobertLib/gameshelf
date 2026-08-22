import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { ZodType } from 'zod';

/**
 * The bridge between a Zod schema from the contracts and react-hook-form.
 *
 * A form field always returns a string - even where the domain expects a number
 * or `null`. The schema in the contracts converts such inputs itself, so the
 * resolver has to cope with a different input type (`TValues`, what the form
 * holds) and output type (`TOutput`, what is sent to the API). That is exactly
 * what this resolver does: it validates the form with the same schema as the
 * server and hands already converted data to `onSubmit`.
 */
export function zodFormResolver<TValues extends FieldValues, TOutput>(
  schema: ZodType<TOutput>,
): Resolver<TValues, unknown, TOutput> {
  return (values) => {
    const result = schema.safeParse(values);

    if (result.success) {
      return { values: result.data, errors: {} };
    }

    const errors: FieldErrors<TValues> = {};
    for (const issue of result.error.issues) {
      assignError(errors, issue.path, {
        type: issue.code,
        message: issue.message,
      });
    }

    return { values: {}, errors };
  };
}

/**
 * Stores an error at the path Zod returns as an array (`['genreIds', 0]`).
 * The first error on a given field wins - the user only needs to know about one.
 */
function assignError(
  target: Record<string, unknown>,
  path: ReadonlyArray<PropertyKey>,
  error: { type: string; message: string },
): void {
  if (path.length === 0) return;

  let cursor: Record<string, unknown> = target;

  for (let index = 0; index < path.length - 1; index += 1) {
    const key = String(path[index]);
    const next = cursor[key];
    if (typeof next !== 'object' || next === null) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }

  const leaf = String(path[path.length - 1]);
  cursor[leaf] ??= error;
}
