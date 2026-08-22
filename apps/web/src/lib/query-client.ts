import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api-error';

/**
 * TanStack Query configuration.
 *
 * The retry rule matters most: a 4xx error means "the server understands you and
 * refuses", so retrying makes no sense. We retry only network failures and 5xx.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiRequestError) {
            if (error.statusCode >= 400 && error.statusCode < 500) return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
