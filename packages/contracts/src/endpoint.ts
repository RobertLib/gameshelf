import type { z } from 'zod';

/**
 * A minimal description of an HTTP endpoint.
 *
 * A single definition drives:
 *  - the path and method for NestJS decorators (`@Post(contract.auth.login.path)`),
 *  - input validation on the backend (`ZodValidationPipe`),
 *  - the controller return type (`Output<typeof endpoint>`),
 *  - the request type and URL in the frontend client,
 *  - the OpenAPI/Swagger documentation.
 *
 * Backend and frontend therefore read the very same object; the only way they
 * can drift apart is by failing `tsc`.
 */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface EndpointDef<
  TPath extends string = string,
  TResponse extends z.ZodType = z.ZodType,
  TBody extends z.ZodType | undefined = z.ZodType | undefined,
  TQuery extends z.ZodType | undefined = z.ZodType | undefined,
> {
  readonly method: HttpMethod;
  /** Path without the `/api` prefix, exactly as NestJS takes it: `games/:id`. */
  readonly path: TPath;
  readonly response: TResponse;
  readonly body?: TBody;
  readonly query?: TQuery;
  /** Requires an access token? Drives both `AuthGuard` and client behavior. */
  readonly auth: boolean;
  /** `multipart/form-data` instead of JSON (image upload). */
  readonly multipart?: boolean;
  readonly summary: string;
  readonly tag: string;
  /** HTTP status on success, when it differs from the Nest default. */
  readonly successStatus?: number;
}

/** Preserves literal types (`const` type parameter), so paths stay exact. */
export function defineEndpoint<
  const T extends EndpointDef<
    string,
    z.ZodType,
    z.ZodType | undefined,
    z.ZodType | undefined
  >,
>(def: T): T {
  return def;
}

export type AnyEndpoint = EndpointDef<
  string,
  z.ZodType,
  z.ZodType | undefined,
  z.ZodType | undefined
>;

/** The type an endpoint returns (and which the controller method must return). */
export type Output<E extends AnyEndpoint> = z.infer<E['response']>;

/**
 * Extracts the named parameters from a path: `'games/:id/notes/:noteId'`
 * yields `{ id: string; noteId: string }`.
 */
export type PathParams<TPath extends string> =
  TPath extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & PathParams<Rest>
    : TPath extends `${string}:${infer Param}`
      ? { [K in Param]: string }
      : Record<never, never>;

/** Fills the `:param` placeholders in a path with concrete values. */
export function buildPath<TPath extends string>(
  path: TPath,
  params?: Record<string, string | number>,
): string {
  if (!params) return path;
  return path.replace(/:([A-Za-z0-9_]+)/g, (match, key: string) => {
    const value = params[key];
    if (value === undefined) {
      throw new Error(`Missing path parameter ":${key}" for "${path}".`);
    }
    return encodeURIComponent(String(value));
  });
}
