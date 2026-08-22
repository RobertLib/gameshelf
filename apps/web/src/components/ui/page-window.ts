/**
 * Which pages to list in the pagination.
 *
 * Its own module, because it is a pure function with non-trivial behavior at
 * the edges - it is tested without rendering the whole component.
 *
 * Shape of the output: 1 … 4 [5] 6 … 20
 */
export function pageWindow(
  current: number,
  total: number,
): Array<number | 'gap'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, total, current]);
  if (current - 1 > 1) pages.add(current - 1);
  if (current + 1 < total) pages.add(current + 1);

  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | 'gap'> = [];

  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && page - previous > 1) result.push('gap');
    result.push(page);
  });

  return result;
}
