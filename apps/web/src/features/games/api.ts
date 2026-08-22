import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  contract,
  type CreateGameInput,
  type Game,
  type GameListQuery,
  type UpdateGameInput,
} from '@gameshelf/contracts';
import { apiRequest } from '~/lib/api-client';
import { queryKeys } from '~/lib/query-keys';

/** The lookup tables change rarely - we keep them long so the form appears instantly. */
export function useCatalog() {
  return useQuery({
    queryKey: queryKeys.catalog,
    queryFn: ({ signal }) => apiRequest(contract.catalog.get, { signal }),
    staleTime: 60 * 60_000,
    gcTime: Infinity,
  });
}

export function useGamesQuery(query: GameListQuery) {
  return useQuery({
    queryKey: queryKeys.games.list(query),
    queryFn: ({ signal }) => apiRequest(contract.games.list, { query, signal }),
    /**
     * When a filter changes, the previous result stays on the screen until the
     * new one arrives. The list therefore does not "vanish" under the user's
     * hands on every keystroke in the search field.
     */
    placeholderData: keepPreviousData,
  });
}

export function useGameQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.games.detail(id ?? ''),
    queryFn: ({ signal }) =>
      apiRequest(contract.games.getById, { params: { id: id! }, signal }),
    enabled: Boolean(id),
  });
}

export function useCollectionOverview() {
  return useQuery({
    queryKey: queryKeys.games.overview(),
    queryFn: ({ signal }) => apiRequest(contract.games.overview, { signal }),
    staleTime: 60_000,
  });
}

export function useCreateGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateGameInput) =>
      apiRequest(contract.games.create, { body: input }),
    onSuccess: (game) => {
      queryClient.setQueryData(queryKeys.games.detail(game.id), game);
      void queryClient.invalidateQueries({ queryKey: queryKeys.games.all });
    },
  });
}

export function useUpdateGame(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateGameInput) =>
      apiRequest(contract.games.update, { params: { id }, body: input }),
    onSuccess: (game) => {
      queryClient.setQueryData(queryKeys.games.detail(game.id), game);
      void queryClient.invalidateQueries({ queryKey: queryKeys.games.lists() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.games.overview(),
      });
    },
  });
}

export function useDeleteGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiRequest(contract.games.remove, { params: { id } }),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.games.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.games.all });
    },
  });
}

/**
 * Toggling the favorite flag from both the list and the game detail.
 *
 * The change is applied immediately (optimistically) and rolled back on error -
 * for an action with only two states, waiting for the response is pointless.
 *
 * Both the list **and** the detail are written optimistically. While the detail
 * was left out, the heart on a game's page looked like it did nothing: the cache
 * was neither overwritten nor invalidated, so the icon stayed in its old state
 * until the next load.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      apiRequest(contract.games.update, {
        params: { id },
        body: { isFavorite },
      }),
    onMutate: async ({ id, isFavorite }) => {
      const detailKey = queryKeys.games.detail(id);

      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.games.lists() }),
        queryClient.cancelQueries({ queryKey: detailKey }),
      ]);

      const snapshot = [
        ...queryClient.getQueriesData({ queryKey: queryKeys.games.lists() }),
        ...queryClient.getQueriesData({ queryKey: detailKey }),
      ];

      queryClient.setQueriesData<{ items: Game[] }>(
        { queryKey: queryKeys.games.lists() },
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((game) =>
                  game.id === id ? { ...game, isFavorite } : game,
                ),
              }
            : current,
      );

      queryClient.setQueryData<Game>(detailKey, (current) =>
        current ? { ...current, isFavorite } : current,
      );

      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.snapshot ?? []) {
        queryClient.setQueryData(key, data);
      }
    },
    // The server also moves `updatedAt` on an update, so we align with it at the end.
    onSuccess: (game) => {
      queryClient.setQueryData(queryKeys.games.detail(game.id), game);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.games.lists() });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.games.overview(),
      });
    },
  });
}

export function useUploadCover() {
  return useMutation({
    mutationFn: (file: File) => apiRequest(contract.uploads.cover, { file }),
  });
}
