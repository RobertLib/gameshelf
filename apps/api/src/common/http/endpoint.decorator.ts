import {
  Body,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  Query,
  SetMetadata,
  applyDecorators,
} from '@nestjs/common';
import type { AnyEndpoint } from '@gameshelf/contracts';
import { ZodValidationPipe } from './zod-validation.pipe';

/** Metadata key under which the endpoint definition is attached to a handler. */
export const ENDPOINT_METADATA = 'gameshelf:endpoint';
/** Marks a public (unprotected) route - set automatically from the contract. */
export const IS_PUBLIC_METADATA = 'gameshelf:public';

const METHOD_DECORATORS = {
  GET: Get,
  POST: Post,
  PATCH: Patch,
  PUT: Put,
  DELETE: Delete,
} as const;

/**
 * A single decorator that derives absolutely everything from the contract
 * definition: the HTTP method, the path, the success status, whether the route
 * is public and the schema for validating the response.
 *
 * ```ts
 * @Endpoint(contract.games.list)
 * list(@ContractQuery(contract.games.list) query: GameListQuery)
 *   : Promise<Output<typeof contract.games.list>> { ... }
 * ```
 *
 * Renaming a path in the contract therefore remaps the route automatically -
 * there is nowhere to forget one of the two sides.
 */
export function Endpoint(endpoint: AnyEndpoint): MethodDecorator {
  const routeDecorator = METHOD_DECORATORS[endpoint.method];

  const decorators: MethodDecorator[] = [
    routeDecorator(endpoint.path),
    SetMetadata(ENDPOINT_METADATA, endpoint),
  ];

  if (endpoint.successStatus !== undefined) {
    decorators.push(HttpCode(endpoint.successStatus));
  }
  if (!endpoint.auth) {
    decorators.push(SetMetadata(IS_PUBLIC_METADATA, true));
  }

  return applyDecorators(...decorators);
}

/** `@Body()` validated by the schema of the given endpoint. */
export function ContractBody(endpoint: AnyEndpoint): ParameterDecorator {
  if (!endpoint.body) {
    throw new Error(
      `Endpoint ${endpoint.method} ${endpoint.path} has no request body defined.`,
    );
  }
  return Body(new ZodValidationPipe(endpoint.body));
}

/** `@Query()` validated by the schema of the given endpoint. */
export function ContractQuery(endpoint: AnyEndpoint): ParameterDecorator {
  if (!endpoint.query) {
    throw new Error(
      `Endpoint ${endpoint.method} ${endpoint.path} has no query parameters defined.`,
    );
  }
  return Query(new ZodValidationPipe(endpoint.query));
}
