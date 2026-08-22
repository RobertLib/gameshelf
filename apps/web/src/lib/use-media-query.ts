import { useEffect, useState } from 'react';

/**
 * Does the given media query match?
 *
 * It is used where `hidden lg:block` is not enough: CSS only hides the element,
 * but the component stays mounted and its effects keep running. For the filter
 * panel that meant two instances at once (the sidebar column plus the slide-out
 * panel), and therefore two independent search field states and two separate
 * debounce timers.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);

    // The width may have changed between the first render and the effect running.
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}

/** Tailwind's `lg` breakpoint - from there the filter sidebar fits. */
export const DESKTOP_QUERY = '(min-width: 64rem)';
