import { useCallback, useState } from 'react';

/**
 * A small user preference stored in the browser (view mode, theme).
 *
 * Both reading and writing are in try/catch - in a private window or with
 * storage disabled they should yield the default value, not take the application
 * down.
 */
export function useLocalStorage<T extends string>(
  key: string,
  /** The default value, or a function computing it (only on the first render). */
  fallback: T | (() => T),
  isValid: (value: string) => value is T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const initial = () =>
      typeof fallback === 'function' ? fallback() : fallback;
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null && isValid(stored) ? stored : initial();
    } catch {
      return initial();
    }
  });

  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // The preference will not persist across sessions; it works in this one.
      }
    },
    [key],
  );

  return [value, update];
}
