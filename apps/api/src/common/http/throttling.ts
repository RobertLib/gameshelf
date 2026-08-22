import { Throttle } from '@nestjs/throttler';

/**
 * Tightened limits for sensitive endpoints.
 *
 * Mind the throttler name: `ThrottlerGuard` iterates **only over the throttlers
 * configured in `ThrottlerModule`** and looks up `@Throttle` metadata under
 * their names. `@Throttle({ auth: … })` on an application that only configures
 * `default` is therefore never read and the route stays on the global limit - a
 * silent and unpleasant way to lose the protection of the sign-in endpoint.
 *
 * So we override `default` instead. That is not a limitation: the counter key is
 * built from the class name, the method name and the throttler name, so every
 * handler has its own bucket and its limit does not mix with other endpoints.
 */

/** Sign-in and registration - the prime target of password guessing. */
export const AUTH_THROTTLE = { limit: 10, ttl: 60_000 } as const;

/** Session refresh. Looser, because ordinary use of the application triggers it too. */
export const REFRESH_THROTTLE = { limit: 60, ttl: 60_000 } as const;

/** File uploads are an order of magnitude more expensive than an ordinary request. */
export const UPLOAD_THROTTLE = { limit: 30, ttl: 60_000 } as const;

export const ThrottleAuth = (): MethodDecorator =>
  Throttle({ default: AUTH_THROTTLE });

export const ThrottleRefresh = (): MethodDecorator =>
  Throttle({ default: REFRESH_THROTTLE });

export const ThrottleUpload = (): MethodDecorator =>
  Throttle({ default: UPLOAD_THROTTLE });
