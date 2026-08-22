import { HttpException, HttpStatus } from '@nestjs/common';
import type { ZodError } from 'zod';

/**
 * A domain exception carrying a machine-readable code.
 *
 * The frontend decides by `code`, not by the message text - texts change, codes
 * do not. The response shape matches `apiErrorSchema` from the contracts.
 */
export class DomainException extends HttpException {
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(params: {
    status: HttpStatus;
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  }) {
    super(
      {
        statusCode: params.status,
        code: params.code,
        message: params.message,
        ...(params.fieldErrors ? { fieldErrors: params.fieldErrors } : {}),
      },
      params.status,
    );
    this.code = params.code;
    this.fieldErrors = params.fieldErrors;
  }
}

export const AppErrors = {
  /**
   * A deliberate trade-off: this tells an attacker that the address is
   * registered.
   *
   * Signing in gives nothing away (see `PasswordService.burnTime`), but
   * registration cannot both be honest to the user and silent about it without
   * an email round trip - "we have sent you a link" is the only answer that
   * works for a stranger and for the owner alike. Until there is a mail
   * channel, a usable form wins over hiding the address, and the registration
   * endpoint has its own tightened rate limit (`AUTH_THROTTLE`).
   */
  emailTaken: (email: string) =>
    new DomainException({
      status: HttpStatus.CONFLICT,
      code: 'EMAIL_TAKEN',
      message: `An account with the email ${email} already exists.`,
      fieldErrors: { email: ['This email is already registered.'] },
    }),

  invalidCredentials: () =>
    new DomainException({
      status: HttpStatus.UNAUTHORIZED,
      code: 'INVALID_CREDENTIALS',
      message: 'Incorrect email or password.',
    }),

  /** The email change asks for a password, and none arrived. */
  currentPasswordRequired: () =>
    new DomainException({
      status: HttpStatus.BAD_REQUEST,
      code: 'CURRENT_PASSWORD_REQUIRED',
      message: 'Changing the email requires your current password.',
      fieldErrors: {
        currentPassword: [
          'Enter your current password to change the email address.',
        ],
      },
    }),

  invalidCurrentPassword: () =>
    new DomainException({
      status: HttpStatus.BAD_REQUEST,
      code: 'INVALID_CURRENT_PASSWORD',
      message: 'The current password does not match.',
      fieldErrors: {
        currentPassword: ['The current password does not match.'],
      },
    }),

  unauthenticated: (message = 'Please sign in again.') =>
    new DomainException({
      status: HttpStatus.UNAUTHORIZED,
      code: 'UNAUTHENTICATED',
      message,
    }),

  refreshTokenInvalid: () =>
    new DomainException({
      status: HttpStatus.UNAUTHORIZED,
      code: 'REFRESH_TOKEN_INVALID',
      message: 'The session has expired, please sign in again.',
    }),

  gameNotFound: () =>
    new DomainException({
      status: HttpStatus.NOT_FOUND,
      code: 'GAME_NOT_FOUND',
      message: 'The game was not found in your collection.',
    }),

  platformNotFound: () =>
    new DomainException({
      status: HttpStatus.BAD_REQUEST,
      code: 'PLATFORM_NOT_FOUND',
      message: 'The selected platform does not exist.',
      fieldErrors: { platformId: ['The selected platform does not exist.'] },
    }),

  genresNotFound: (ids: string[]) =>
    new DomainException({
      status: HttpStatus.BAD_REQUEST,
      code: 'GENRES_NOT_FOUND',
      message: `Unknown genres: ${ids.join(', ')}.`,
      fieldErrors: { genreIds: ['Some of the selected genres do not exist.'] },
    }),

  uploadRejected: (message: string) =>
    new DomainException({
      status: HttpStatus.BAD_REQUEST,
      code: 'UPLOAD_REJECTED',
      message,
    }),
} as const;

/** Input validation error - carries the original Zod issues for conversion to `fieldErrors`. */
export class RequestValidationException extends DomainException {
  constructor(error: ZodError, source: 'body' | 'query' | 'params') {
    super({
      status: HttpStatus.BAD_REQUEST,
      code: 'VALIDATION_FAILED',
      message:
        source === 'body'
          ? 'Please check the values you entered.'
          : 'Invalid request parameters.',
      fieldErrors: zodIssuesToFieldErrors(error),
    });
  }
}

/** Turns Zod issues into a `path -> [messages]` map the form can display. */
export function zodIssuesToFieldErrors(
  error: ZodError,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    (result[key] ??= []).push(issue.message);
  }
  return result;
}
