import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ApiError } from '@gameshelf/contracts';
import type { Request, Response } from 'express';
import { DomainException } from '../errors';

/**
 * The single place where the body of an error response is created.
 *
 * The output always matches `apiErrorSchema` from the contracts, so the frontend
 * can rely on the shape of an error no matter whether validation, authorization,
 * the database or something entirely unexpected failed.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const error = this.toApiError(exception, request);

    if (error.statusCode >= SERVER_ERROR_FROM) {
      this.logger.error(
        `${request.method} ${request.url} → ${error.statusCode} ${error.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(error.statusCode).json(error);
  }

  private toApiError(exception: unknown, request: Request): ApiError {
    const base = {
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (exception instanceof DomainException) {
      return {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: messageOf(exception),
        ...(exception.fieldErrors
          ? { fieldErrors: exception.fieldErrors }
          : {}),
        ...base,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return { ...this.fromPrisma(exception), ...base };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();

      return {
        statusCode: status,
        code: DEFAULT_CODES[status] ?? 'HTTP_ERROR',
        message: messageOf(exception),
        ...base,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: this.isProduction
        ? 'Something went wrong. Please try again.'
        : exception instanceof Error
          ? exception.message
          : String(exception),
      ...base,
    };
  }

  private fromPrisma(
    exception: Prisma.PrismaClientKnownRequestError,
  ): Pick<ApiError, 'statusCode' | 'code' | 'message'> {
    switch (exception.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'UNIQUE_CONSTRAINT',
          message: 'A record with these values already exists.',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          code: 'FOREIGN_KEY_CONSTRAINT',
          message: 'The referenced record does not exist.',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'The record was not found.',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'DATABASE_ERROR',
          message: 'Database error.',
        };
    }
  }
}

/**
 * `HttpStatus` is a TypeScript enum, so comparing it with a plain number is
 * type-suspicious. We therefore name the threshold as a `number` - the code
 * stays readable and nobody has to guess what 500 means.
 */
const SERVER_ERROR_FROM: number = HttpStatus.INTERNAL_SERVER_ERROR;

/**
 * The text from an exception body.
 *
 * Depending on the situation Nest puts a string, an object with `message` or an
 * array of messages (validation) into `getResponse()` - and `String()` over the
 * last of those, or over a nested object, happily produces `[object Object]`.
 * There used to be two different variants of this unwrapping in two branches of
 * this method; here there is one.
 */
function messageOf(exception: HttpException): string {
  const payload: unknown = exception.getResponse();

  if (typeof payload === 'string') return payload;

  if (typeof payload === 'object' && payload !== null) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) {
      return message.map((item) => String(item)).join(' ');
    }
  }

  return exception.message;
}

const DEFAULT_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};
