import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Identity of the signed-in user, put into the request by `AccessTokenGuard`. */
export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare module 'express' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

/**
 * `@CurrentUser() user: AuthenticatedUser` in a controller.
 *
 * The guard runs globally and lets no protected route through without a user, so
 * `undefined` does not have to be handled here - if it happened anyway it is a
 * programming error and fails loudly.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new Error(
        'CurrentUser used on a route that is not protected by AccessTokenGuard.',
      );
    }
    return request.user;
  },
);
