import type { GameListQueryInput } from '@gameshelf/contracts';

/**
 * The TanStack Query keys in one place.
 *
 * The hierarchy allows targeted invalidation: `queryKeys.games.all` invalidates
 * every list and detail at once, `queryKeys.games.detail(id)` only one.
 */
export const queryKeys = {
  session: ['session'] as const,
  catalog: ['catalog'] as const,
  games: {
    all: ['games'] as const,
    lists: () => [...queryKeys.games.all, 'list'] as const,
    list: (query: GameListQueryInput) =>
      [...queryKeys.games.lists(), query] as const,
    details: () => [...queryKeys.games.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.games.details(), id] as const,
    overview: () => [...queryKeys.games.all, 'overview'] as const,
  },
} as const;
