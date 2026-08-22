import { describe, expect, it } from 'vitest';
import { pageWindow } from './page-window';

describe('pageWindow', () => {
  it('lists every page without an ellipsis up to seven pages', () => {
    expect(pageWindow(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('elides both edges in the middle of a long list', () => {
    expect(pageWindow(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20]);
  });

  it('elides only the end at the beginning', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 'gap', 20]);
  });

  it('elides only the beginning at the end', () => {
    expect(pageWindow(20, 20)).toEqual([1, 'gap', 19, 20]);
  });

  it('does not insert an ellipsis where nothing is missing', () => {
    // There is nothing to omit between 1 and 2, even though the pages are
    // otherwise far apart.
    expect(pageWindow(2, 20)).toEqual([1, 2, 3, 'gap', 20]);
  });

  it('never returns a duplicate page number', () => {
    for (let total = 1; total <= 30; total += 1) {
      for (let current = 1; current <= total; current += 1) {
        const pages = pageWindow(current, total).filter(
          (entry): entry is number => entry !== 'gap',
        );
        expect(new Set(pages).size).toBe(pages.length);
        // The sequence has to ascend, otherwise the pages would jump around
        // confusingly.
        expect([...pages].sort((a, b) => a - b)).toEqual(pages);
      }
    }
  });
});
