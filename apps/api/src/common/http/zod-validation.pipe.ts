import {
  Injectable,
  PipeTransform,
  type ArgumentMetadata,
} from '@nestjs/common';
import type { ZodType } from 'zod';
import { RequestValidationException } from '../errors';

/**
 * Validates and at the same time converts the input against a schema from
 * @gameshelf/contracts.
 *
 * It returns the `parse`d data, so the controller gets exactly the type the
 * contract promises - including filled-in defaults and converted query strings.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const source =
        metadata.type === 'query'
          ? 'query'
          : metadata.type === 'param'
            ? 'params'
            : 'body';
      throw new RequestValidationException(result.error, source);
    }
    return result.data;
  }
}
