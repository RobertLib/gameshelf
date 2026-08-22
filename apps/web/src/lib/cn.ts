/**
 * Joins conditional classes. Deliberately without `clsx`/`tailwind-merge` - this
 * is all we need and another dependency would not earn its place for it.
 */
export type ClassValue =
  string | number | null | undefined | false | ClassValue[];

export function cn(...values: ClassValue[]): string {
  const out: string[] = [];

  for (const value of values) {
    if (!value && value !== 0) continue;
    if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) out.push(nested);
    } else {
      out.push(String(value));
    }
  }

  return out.join(' ');
}
