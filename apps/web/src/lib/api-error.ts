import { apiErrorSchema, type ApiError } from '@gameshelf/contracts';

/**
 * An API error in a form the UI can work with.
 *
 * Thanks to `apiErrorSchema` the error body has a guaranteed shape, so `code`
 * and `fieldErrors` are available through types rather than guessed out of `any`.
 */
export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string[]>;

  constructor(payload: ApiError) {
    super(payload.message);
    this.name = 'ApiRequestError';
    this.statusCode = payload.statusCode;
    this.code = payload.code;
    this.fieldErrors = payload.fieldErrors ?? {};
  }

  /** The error on a specific form field, if the server sent one. */
  fieldError(field: string): string | undefined {
    return this.fieldErrors[field]?.[0];
  }

  get isUnauthenticated(): boolean {
    return this.statusCode === 401;
  }

  get isNotFound(): boolean {
    return this.statusCode === 404;
  }

  /** Builds an error even from a response that does not match the contract (a proxy, a 502…). */
  static async fromResponse(response: Response): Promise<ApiRequestError> {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // An empty or unreadable response - we use the generic text below.
    }

    const parsed = apiErrorSchema.safeParse(body);
    if (parsed.success) return new ApiRequestError(parsed.data);

    return new ApiRequestError({
      statusCode: response.status,
      code: 'UNEXPECTED_RESPONSE',
      message:
        response.status >= 500
          ? 'The server is not responding correctly. Please try again shortly.'
          : `Unexpected response from the server (${response.status}).`,
    });
  }

  /** A network failure - fetch rejects before any response arrives. */
  static networkFailure(): ApiRequestError {
    return new ApiRequestError({
      statusCode: 0,
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check your connection.',
    });
  }
}

/** Safely extracts the error text from anything that ends up in a `catch`. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred.';
}
