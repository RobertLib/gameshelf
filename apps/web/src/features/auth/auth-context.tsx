import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  contract,
  type AuthSession,
  type LoginInput,
  type RegisterInput,
  type User,
} from '@gameshelf/contracts';
import { apiRequest } from '~/lib/api-client';
import { queryKeys } from '~/lib/query-keys';
import {
  onSessionExpired,
  refreshSession,
  setAccessToken,
} from '~/lib/session';

interface AuthContextValue {
  user: User | null;
  /** While the first session refresh is running we do not know whether the user is signed in. */
  isBootstrapping: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Updates the user after a profile change without another request to the server. */
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The source of truth about being signed in.
 *
 * At startup it tries once to exchange the refresh cookie for a session - which
 * is why reloading the page (F5) does not throw the user out even though the
 * access token is not stored anywhere.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const sessionQuery = useQuery<AuthSession | null>({
    queryKey: queryKeys.session,
    queryFn: () => refreshSession(),
    staleTime: Infinity,
    gcTime: Infinity,
    /**
     * A refused refresh returns `null` - that is a final answer and is not
     * retried. An unreachable server, though, is thrown by `refreshSession` as an
     * error, and that is worth retrying: a short outage while the page loaded
     * otherwise looked like a sign-out even though the user had a valid cookie.
     * Until the attempts run out, `isPending` keeps the "Checking your sign-in…"
     * screen up.
     */
    retry: (failureCount) => failureCount < 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    /**
     * And when even that is not enough, it is retried as soon as the connection
     * returns - a query without data is always stale, so the refresh starts on
     * its own and the user goes back from the sign-in page into the application.
     */
    refetchOnReconnect: true,
  });

  const applySession = useCallback(
    (session: AuthSession) => {
      setAccessToken(session.accessToken);
      queryClient.setQueryData(queryKeys.session, session);
    },
    [queryClient],
  );

  /**
   * The session is refreshed shortly before the token expires, so the user
   * notices nothing during a long stretch of work with the collection. Should the
   * window fall asleep meanwhile, the equally silent refresh after the first 401
   * in the API client saves the day.
   */
  useEffect(() => {
    const session = sessionQuery.data;
    if (!session) return;

    const delayMs = Math.max((session.expiresIn - 60) * 1000, 30_000);
    const timer = window.setTimeout(() => {
      void refreshSession()
        .then((next) => {
          if (next) queryClient.setQueryData(queryKeys.session, next);
        })
        /**
         * An unreachable server throws here (`SessionUnavailableError`), and the
         * unhandled rejection was the smaller half of the problem: the query
         * data would not change, so this effect would not re-run and nothing
         * would ever schedule the next refresh. Handing the job back to the
         * session query is enough - it already knows how to retry and how to
         * wait for the connection to come back.
         */
        .catch(() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.session });
        });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [sessionQuery.data, queryClient]);

  /** The server refused the refresh (e.g. after a password change elsewhere) - we clean up the local state. */
  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.setQueryData(queryKeys.session, null);
        queryClient.removeQueries({ queryKey: queryKeys.games.all });
      }),
    [queryClient],
  );

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) =>
      apiRequest(contract.auth.login, { body: input }),
    onSuccess: applySession,
  });

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) =>
      apiRequest(contract.auth.register, { body: input }),
    onSuccess: applySession,
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest(contract.auth.logout),
    // Even if signing out fails on the server we end the session locally -
    // otherwise the user would stay stuck in the application they wanted to leave.
    onSettled: () => {
      setAccessToken(null);
      // The signed-out user's data is discarded first and only then is "there
      // is no session" written - in the opposite order `clear()` would erase
      // that write and the next screen would needlessly ask the server again.
      queryClient.clear();
      queryClient.setQueryData(queryKeys.session, null);
    },
  });

  /**
   * The dependencies list `mutateAsync`, not the whole objects from
   * `useMutation`. Those get a new identity after every render (they carry
   * `isPending` and friends), so memoization would never save anything and every
   * render would push a new context to all subscribers. `mutateAsync`, by
   * contrast, is stable.
   */
  const { mutateAsync: doLogin } = loginMutation;
  const { mutateAsync: doRegister } = registerMutation;
  const { mutateAsync: doLogout } = logoutMutation;

  const value = useMemo<AuthContextValue>(
    () => ({
      user: sessionQuery.data?.user ?? null,
      isBootstrapping: sessionQuery.isPending,
      login: async (input) => {
        await doLogin(input);
      },
      register: async (input) => {
        await doRegister(input);
      },
      logout: async () => {
        await doLogout();
      },
      updateUser: (user) => {
        queryClient.setQueryData<AuthSession | null>(
          queryKeys.session,
          (current) => (current ? { ...current, user } : current),
        );
      },
    }),
    [
      sessionQuery.data,
      sessionQuery.isPending,
      doLogin,
      doRegister,
      doLogout,
      queryClient,
    ],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useAuth can only be used inside <AuthProvider>.');
  }
  return context;
}
