import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppErrors } from '../errors';
import { IS_PUBLIC_METADATA } from '../http/endpoint.decorator';
import type { AuthenticatedUser } from './current-user';

/** Access token payload. */
export interface AccessTokenPayload {
  /** User ID. */
  sub: string;
  email: string;
}

/**
 * A global guard - everything is protected unless it explicitly asks not to be.
 *
 * A route does not ask for that by hand but through `auth: false` in the
 * contract, which the `@Endpoint` decorator turns into `IS_PUBLIC_METADATA`.
 * Forgetting to protect a new endpoint is therefore impossible.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);
    if (!token) throw AppErrors.unauthenticated('Missing access token.');

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw AppErrors.unauthenticated(
        'The access token has expired or is invalid.',
      );
    }

    const user: AuthenticatedUser = { id: payload.sub, email: payload.email };
    request.user = user;
    return true;
  }
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim() || null;
}
