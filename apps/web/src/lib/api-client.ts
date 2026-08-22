import {
  API_PREFIX,
  buildPath,
  toSearchParams,
  UPLOAD_FIELD_NAME,
  type AnyEndpoint,
  type Output,
  type PathParams,
} from '@gameshelf/contracts';
import type { z } from 'zod';
import { ApiRequestError } from './api-error';
import { getAccessToken, refreshAccessToken } from './session';

/**
 * A typed HTTP client driven by the contracts.
 *
 * `apiRequest(contract.games.update, { params: { id }, body })` derives the
 * method, the path, the body shape, the query shape and the return type from a
 * single definition. A typo in a field name or a forgotten path parameter is a
 * compile error, not a 400 at runtime.
 */

/* --- deriving the arguments from the endpoint definition ------------------ */

type BodyArg<E> = E extends { body: z.ZodType }
  ? { body: z.input<E['body']> }
  : Record<never, never>;

type QueryArg<E> = E extends { query: z.ZodType }
  ? { query?: z.input<E['query']> }
  : Record<never, never>;

type FileArg<E> = E extends { multipart: true }
  ? { file: File }
  : Record<never, never>;

type ParamsArg<E extends AnyEndpoint> = keyof PathParams<
  E['path']
> extends never
  ? Record<never, never>
  : { params: PathParams<E['path']> };

interface CommonArgs {
  signal?: AbortSignal;
}

type Simplify<T> = { [K in keyof T]: T[K] } & {};

type RequestArgs<E extends AnyEndpoint> = Simplify<
  BodyArg<E> & QueryArg<E> & FileArg<E> & ParamsArg<E> & CommonArgs
>;

type RequiredKeys<T> = {
  [K in keyof T]-?: Record<never, never> extends Pick<T, K> ? never : K;
}[keyof T];

/** An endpoint with no required arguments is called with a single parameter. */
type ArgsTuple<E extends AnyEndpoint> = [RequiredKeys<RequestArgs<E>>] extends [
  never,
]
  ? [args?: RequestArgs<E>]
  : [args: RequestArgs<E>];

/* --- the call itself ------------------------------------------------------- */

export async function apiRequest<E extends AnyEndpoint>(
  endpoint: E,
  ...rest: ArgsTuple<E>
): Promise<Output<E>> {
  const args = (rest[0] ?? {}) as Partial<{
    body: unknown;
    query: Record<string, unknown>;
    params: Record<string, string>;
    file: File;
    signal: AbortSignal;
  }>;

  const url = buildUrl(endpoint, args.params, args.query);
  const send = (token: string | null): Promise<Response> =>
    fetch(url, {
      method: endpoint.method,
      credentials: 'same-origin',
      signal: args.signal ?? null,
      headers: buildHeaders(endpoint, token),
      body: buildBody(endpoint, args),
    });

  let response: Response;
  try {
    response = await send(getAccessToken());
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error;
    throw ApiRequestError.networkFailure();
  }

  /**
   * An expired access token only shows up as a 401. We try one silent refresh and
   * repeat the request - the user never notices the token's short lifetime. It is
   * retried only once so that it cannot turn into a loop.
   */
  if (response.status === 401 && endpoint.auth) {
    const token = await refreshAccessToken();
    if (token) {
      try {
        response = await send(token);
      } catch {
        throw ApiRequestError.networkFailure();
      }
    }
  }

  if (!response.ok) throw await ApiRequestError.fromResponse(response);

  const payload: unknown =
    response.status === 204 ? null : await response.json().catch(() => null);

  /**
   * The response is validated against the very schema the server uses. If an
   * incompatible API version is deployed, it surfaces as an understandable error
   * instead of `undefined is not an object` somewhere in a component.
   */
  const parsed = endpoint.response.safeParse(payload);
  if (!parsed.success) {
    throw new ApiRequestError({
      statusCode: response.status,
      code: 'CONTRACT_MISMATCH',
      message:
        'The server response does not match the expected format. Try reloading the page.',
    });
  }

  return parsed.data as Output<E>;
}

function buildUrl(
  endpoint: AnyEndpoint,
  params: Record<string, string> | undefined,
  query: Record<string, unknown> | undefined,
): string {
  const path = buildPath(endpoint.path, params);
  const search = query ? toSearchParams(query).toString() : '';
  return `${API_PREFIX}/${path}${search ? `?${search}` : ''}`;
}

function buildHeaders(
  endpoint: AnyEndpoint,
  token: string | null,
): HeadersInit {
  const headers: Record<string, string> = { Accept: 'application/json' };

  // For multipart we do not set the header - the browser has to add the boundary.
  if (endpoint.body && !endpoint.multipart) {
    headers['Content-Type'] = 'application/json';
  }
  if (endpoint.auth && token) headers['Authorization'] = `Bearer ${token}`;

  return headers;
}

function buildBody(
  endpoint: AnyEndpoint,
  args: { body?: unknown; file?: File },
): BodyInit | null {
  if (endpoint.multipart) {
    if (!args.file) return null;
    const formData = new FormData();
    formData.append(UPLOAD_FIELD_NAME, args.file);
    return formData;
  }
  return args.body === undefined ? null : JSON.stringify(args.body);
}
