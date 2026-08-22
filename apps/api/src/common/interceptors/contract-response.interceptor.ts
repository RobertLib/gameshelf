import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AnyEndpoint } from '@gameshelf/contracts';
import { Observable, map } from 'rxjs';
import { ENDPOINT_METADATA } from '../http/endpoint.decorator';

/**
 * Validates the response against the contract schema before it is sent.
 *
 * Two things we gain by that:
 *  1. The API cannot return a different shape than the frontend expects - a
 *     violation shows up immediately, not in production on the client.
 *  2. Zod objects strip unknown keys by default, so neither `passwordHash` nor
 *     any other internal field can slip into a response by accident.
 *
 * A mismatch fails the request, in production as well as in development.
 *
 * Passing the payload through with only a log line looked like the forgiving
 * option, but it gave up the second guarantee above precisely when it was
 * needed: the payload that goes out unvalidated is the one Zod never stripped,
 * so an internal field could leave the process exactly in the situation nobody
 * was watching. And it bought nothing - the API client validates the same
 * schema, so the browser rejects such a response anyway. The endpoint is
 * broken either way; this way it is broken loudly and in the log.
 */
@Injectable()
export class ContractResponseInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ContractResponseInterceptor.name);

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const endpoint = this.reflector.get<AnyEndpoint | undefined>(
      ENDPOINT_METADATA,
      context.getHandler(),
    );

    if (!endpoint) return next.handle();

    return next.handle().pipe(
      map((payload: unknown) => {
        const result = endpoint.response.safeParse(payload);
        if (result.success) return result.data;

        const detail = result.error.issues
          .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('; ');
        const message = `The response of ${endpoint.method} /${endpoint.path} does not match the contract -> ${detail}`;

        // Logged here rather than left to the exception filter: in production
        // the filter hides the message from the response, and this detail is
        // the only thing that says which field went wrong.
        this.logger.error(message);
        throw new Error(message);
      }),
    );
  }
}
