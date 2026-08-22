import {
  API_PREFIX,
  authSessionSchema,
  contract,
  type AuthSession,
} from '@gameshelf/contracts';

/**
 * Holding the access token.
 *
 * The token lives only in the tab's memory - not in `localStorage`. Should a
 * foreign script get into the application, it cannot pull the token out of
 * memory as easily as out of storage, which is one line away. Surviving a page
 * reload is handled by the refresh token in an httpOnly cookie, which JavaScript
 * cannot see at all.
 */
let accessToken: string | null = null;

/**
 * The server was unreachable - that does not end the session, we simply know
 * nothing about it right now.
 *
 * It has to be a thrown error, not `null`: `null` means "the server refused the
 * refresh", that is a sign-out. While a network failure also returned `null`, a
 * moment without connectivity while the page loaded was enough for
 * `AuthProvider` to send the user to the sign-in screen - even though they had a
 * valid cookie and nobody had signed them out.
 */
export class SessionUnavailableError extends Error {
  constructor() {
    super('The server is currently unreachable.');
    this.name = 'SessionUnavailableError';
  }
}

/** A refresh in flight. Ten parallel requests must not rotate the token ten times. */
let refreshInFlight: Promise<AuthSession | null> | null = null;

type Listener = () => void;
const expiryListeners = new Set<Listener>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Subscribes to the "the session has ended" message (used by `AuthProvider`). */
export function onSessionExpired(listener: Listener): () => void {
  expiryListeners.add(listener);
  return () => {
    expiryListeners.delete(listener);
  };
}

function notifyExpired(): void {
  accessToken = null;
  for (const listener of expiryListeners) listener();
}

/**
 * Exchanges the refresh cookie for a new session.
 *
 * It is called straight through `fetch`, not through `apiRequest` - otherwise a
 * failed refresh would trigger another refresh and loop. Concurrent calls share
 * a single in-flight promise so that the refresh token is not rotated several
 * times at once (which the server would read as token theft and end the
 * session).
 */
export function refreshSession(): Promise<AuthSession | null> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(
        `${API_PREFIX}/${contract.auth.refresh.path}`,
        { method: 'POST', credentials: 'same-origin' },
      );

      if (!response.ok) {
        notifyExpired();
        return null;
      }

      const parsed = authSessionSchema.safeParse(await response.json());
      if (!parsed.success) {
        notifyExpired();
        return null;
      }

      accessToken = parsed.data.accessToken;
      return parsed.data;
    } catch {
      // A network failure is not the end of the session: we leave the token
      // alone and ask for a retry, not for the sign-in screen.
      throw new SessionUnavailableError();
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * A shortened variant for the API client - all it cares about is the new token.
 *
 * An unreachable server has nothing to report here: the caller is dealing with
 * its own request, which will fail with the original error. Without the `null`,
 * the refresh error would be thrown instead of an understandable message about
 * the failed request.
 */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    return (await refreshSession())?.accessToken ?? null;
  } catch {
    return null;
  }
}
