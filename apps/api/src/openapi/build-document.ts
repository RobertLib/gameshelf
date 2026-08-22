import { z } from 'zod';
import {
  API_PREFIX,
  allEndpoints,
  apiErrorSchema,
  type AnyEndpoint,
} from '@gameshelf/contracts';

/**
 * An OpenAPI document assembled straight from the contracts.
 *
 * We do not use `@ApiProperty` decorators - they would mean describing every
 * field a second time and letting the two copies drift apart. Zod 4 provides
 * `toJSONSchema()`, so the documentation comes from the very schema that also
 * validates the data.
 */

type JsonSchema = Record<string, unknown>;

function toJsonSchema(schema: z.ZodType): JsonSchema {
  try {
    return z.toJSONSchema(schema, {
      target: 'draft-2020-12',
      io: 'output',
      unrepresentable: 'any',
    });
  } catch {
    // A schema with a transform may not be expressible; the documentation
    // should not fail because of that.
    return {};
  }
}

/** `games/:id` -> `/api/games/{id}` (OpenAPI uses curly braces). */
function toOpenApiPath(endpoint: AnyEndpoint): string {
  const path = endpoint.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
  return `${API_PREFIX}/${path}`;
}

function pathParameters(endpoint: AnyEndpoint): JsonSchema[] {
  return [...endpoint.path.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => ({
    name: match[1],
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
}

function queryParameters(endpoint: AnyEndpoint): JsonSchema[] {
  if (!endpoint.query) return [];

  const schema = toJsonSchema(endpoint.query);
  const properties = (schema['properties'] ?? {}) as Record<string, JsonSchema>;
  const required = new Set((schema['required'] ?? []) as string[]);

  return Object.entries(properties).map(([name, propertySchema]) => ({
    name,
    in: 'query',
    required: required.has(name),
    schema: propertySchema,
    ...(propertySchema['description']
      ? { description: propertySchema['description'] }
      : {}),
  }));
}

function operationOf(endpoint: AnyEndpoint): JsonSchema {
  const successStatus = String(
    endpoint.successStatus ?? (endpoint.method === 'POST' ? 201 : 200),
  );

  const operation: JsonSchema = {
    summary: endpoint.summary,
    tags: [endpoint.tag],
    parameters: [...pathParameters(endpoint), ...queryParameters(endpoint)],
    responses: {
      [successStatus]: {
        description: 'OK',
        content: {
          'application/json': { schema: toJsonSchema(endpoint.response) },
        },
      },
      '4XX': {
        description: 'Request error',
        content: {
          'application/json': { schema: toJsonSchema(apiErrorSchema) },
        },
      },
    },
  };

  if (endpoint.auth) operation['security'] = [{ bearer: [] }];

  if (endpoint.multipart) {
    operation['requestBody'] = {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: { file: { type: 'string', format: 'binary' } },
            required: ['file'],
          },
        },
      },
    };
  } else if (endpoint.body) {
    operation['requestBody'] = {
      required: true,
      content: {
        'application/json': { schema: toJsonSchema(endpoint.body) },
      },
    };
  }

  return operation;
}

export function buildOpenApiDocument(version: string): JsonSchema {
  const paths: Record<string, JsonSchema> = {};

  for (const endpoint of allEndpoints) {
    const path = toOpenApiPath(endpoint);
    const item = (paths[path] ??= {});
    item[endpoint.method.toLowerCase()] = operationOf(endpoint);
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'GameShelf API',
      version,
      description:
        'A catalog of a physical game collection. The documentation is ' +
        'generated from the same Zod schemas that validate the requests ' +
        '(the @gameshelf/contracts package).',
    },
    tags: [
      { name: 'auth', description: 'Registration, sign-in, profile' },
      { name: 'catalog', description: 'Platform and genre lookup tables' },
      { name: 'games', description: 'The game collection' },
      { name: 'uploads', description: 'Cover image uploads' },
    ],
    components: {
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    paths,
  };
}
