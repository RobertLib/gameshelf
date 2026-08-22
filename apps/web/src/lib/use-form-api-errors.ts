import { useCallback } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiRequestError } from './api-error';

/**
 * Carries the server's field errors into the form.
 *
 * The backend returns `fieldErrors` in the form `{ "email": ["..."] }` - the same
 * path the field has in the form. Every form in the application uses it, which is
 * why it lives in `lib/` rather than next to one particular feature. Errors that
 * bind to no field (a different name, an error at the level of the whole form)
 * are returned to the caller so it can show them above the form.
 */
export function useFormApiErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  knownFields: ReadonlyArray<Path<T>>,
) {
  return useCallback(
    (error: unknown): string | null => {
      if (!(error instanceof ApiRequestError)) {
        return error instanceof Error
          ? error.message
          : 'An unexpected error occurred.';
      }

      let matched = false;
      for (const [field, messages] of Object.entries(error.fieldErrors)) {
        const message = messages[0];
        if (!message) continue;
        if (!knownFields.includes(field as Path<T>)) continue;

        setError(field as Path<T>, { type: 'server', message });
        matched = true;
      }

      // When the errors could be placed on fields, we do not repeat the message
      // above the form - otherwise the user would read the same thing twice.
      return matched ? null : error.message;
    },
    [setError, knownFields],
  );
}
