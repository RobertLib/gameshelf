import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '~/lib/cn';
import { useFieldContext } from './Field';

const CONTROL =
  'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors ' +
  'placeholder:text-slate-400 focus:outline-2 focus:outline-offset-0 focus:outline-brand-500 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 ' +
  'dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-800';

const BORDER_OK = 'border-slate-300 dark:border-slate-700';
const BORDER_ERROR = 'border-red-400 dark:border-red-500';

interface WithError {
  /**
   * Renders the field in an error state and sets `aria-invalid`. Inside a `Field`
   * it is filled in from its `error` prop, so the prop is only useful outside a
   * `Field` (or when the caller wants to force the state differently).
   */
  invalid?: boolean;
}

/**
 * The accessibility attributes a control picks up from the surrounding `Field`.
 * An explicitly passed value always wins.
 */
function useControlAria(
  invalid: boolean | undefined,
  describedBy: string | undefined,
): { 'aria-invalid'?: true; 'aria-describedby'?: string; invalid: boolean } {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;
  const description = describedBy ?? field?.describedBy;

  return {
    ...(isInvalid ? { 'aria-invalid': true as const } : {}),
    ...(description ? { 'aria-describedby': description } : {}),
    invalid: isInvalid,
  };
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & WithError
>(function Input(
  { className, invalid, 'aria-describedby': describedBy, ...props },
  ref,
) {
  const { invalid: isInvalid, ...aria } = useControlAria(invalid, describedBy);

  return (
    <input
      ref={ref}
      {...aria}
      className={cn(
        CONTROL,
        isInvalid ? BORDER_ERROR : BORDER_OK,
        'h-10',
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & WithError
>(function Textarea(
  { className, invalid, 'aria-describedby': describedBy, ...props },
  ref,
) {
  const { invalid: isInvalid, ...aria } = useControlAria(invalid, describedBy);

  return (
    <textarea
      ref={ref}
      {...aria}
      className={cn(
        CONTROL,
        isInvalid ? BORDER_ERROR : BORDER_OK,
        'min-h-24 resize-y',
        className,
      )}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & WithError
>(function Select(
  { className, invalid, 'aria-describedby': describedBy, children, ...props },
  ref,
) {
  const { invalid: isInvalid, ...aria } = useControlAria(invalid, describedBy);

  return (
    <select
      ref={ref}
      {...aria}
      className={cn(
        CONTROL,
        isInvalid ? BORDER_ERROR : BORDER_OK,
        'h-10 pr-8',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
