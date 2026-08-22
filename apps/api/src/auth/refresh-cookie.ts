import { REFRESH_COOKIE_NAME, API_PREFIX } from '@gameshelf/contracts';
import type { CookieOptions, Request, Response } from 'express';
import type { AppConfig } from '../config/env';

/**
 * The refresh token lives exclusively in an httpOnly cookie.
 *
 * `httpOnly` hides it from JavaScript (and thereby from XSS), `sameSite: 'lax'`
 * prevents its use from a foreign page and `path` sends it only to the auth
 * endpoints, so it does not travel with every request to `/api/games`.
 */
export function refreshCookieOptions(
  config: AppConfig,
  expiresAt?: Date,
): CookieOptions {
  return {
    httpOnly: true,
    secure: config.auth.cookieSecure,
    sameSite: 'lax',
    path: `${API_PREFIX}/auth`,
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

export function setRefreshCookie(
  response: Response,
  config: AppConfig,
  token: string,
  expiresAt: Date,
): void {
  response.cookie(
    REFRESH_COOKIE_NAME,
    token,
    refreshCookieOptions(config, expiresAt),
  );
}

export function clearRefreshCookie(
  response: Response,
  config: AppConfig,
): void {
  response.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions(config));
}

export function readRefreshCookie(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, string> | undefined;
  const value = cookies?.[REFRESH_COOKIE_NAME];
  return value && value.length > 0 ? value : undefined;
}
