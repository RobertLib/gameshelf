import { createContext, use, type ReactNode } from 'react';
import { cn } from '~/lib/cn';

/**
 * Wiring the labels to the control.
 *
 * `aria-describedby` has to sit on the input itself - a screen reader reads
 * nothing off the wrapping `<div>`, because that is not a form control. Passing
 * it by hand in each of thirty usages is exactly the `aria-*` repetition `Field`
 * is meant to prevent, so `Input`/`Select`/`Textarea` pick it up from here.
 * `invalid` travels the same way: `Field` already received the error in its
 * `error` prop, there is no reason to pass it a second time everywhere as
 * `invalid={Boolean(errors.x)}`.
 */
interface FieldContextValue {
  describedBy?: string;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** For `Input`, `Select` and `Textarea`. Outside a `Field` it returns `null`. */
export function useFieldContext(): FieldContextValue | null {
  return use(FieldContext);
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  /** A validation error - shown below the field and marking it red. */
  error?: string;
  /** A hint below the field; hidden while an error is displayed. */
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * The wrapper of a form field: the label, the error message and the wiring for
 * screen readers. Thanks to it every field behaves consistently without
 * repeating `aria-*`.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: FieldProps) {
  const errorId = htmlFor && error ? `${htmlFor}-error` : undefined;
  const hintId = htmlFor && !error && hint ? `${htmlFor}-hint` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden>
            *
          </span>
        )}
      </label>

      <FieldContext
        value={{
          ...((errorId ?? hintId) ? { describedBy: errorId ?? hintId } : {}),
          invalid: Boolean(error),
        }}
      >
        {children}
      </FieldContext>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
