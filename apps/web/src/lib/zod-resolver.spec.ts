import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createGameSchema } from '@gameshelf/contracts';
import { zodFormResolver } from './zod-resolver';

/**
 * The resolver is the only place where "the form holds nothing but strings"
 * meets the domain type. When it breaks, it shows up as an error that is not
 * displayed or a value that is converted wrongly - that is, silently.
 */
describe('zodFormResolver', () => {
  const resolve = <T>(schema: z.ZodType<T>, values: unknown) =>
    zodFormResolver(schema)(values as never, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    }) as {
      values: unknown;
      errors: Record<string, { message?: string }>;
    };

  it('returns converted data and no errors for a valid input', () => {
    const result = resolve(createGameSchema, {
      title: '  Half-Life  ',
      platformId: 'pc',
      purchasePrice: '349,50',
      releaseYear: '1998',
    });

    expect(result.errors).toEqual({});
    expect(result.values).toMatchObject({
      title: 'Half-Life',
      purchasePrice: 349.5,
      releaseYear: 1998,
      // The defaults are filled in by the same schema the server uses.
      region: 'PAL',
      quantity: 1,
    });
  });

  it('stores an error under the field name so the form finds it', () => {
    const result = resolve(createGameSchema, { title: '', platformId: 'pc' });

    expect(result.errors['title']?.message).toBe('The title is required.');
    expect(result.values).toEqual({});
  });

  it('returns empty data on an error so nothing is half-saved', () => {
    const result = resolve(createGameSchema, { title: 'Game' });
    expect(result.values).toEqual({});
  });

  it('the first error on a field wins, the user does not read two at once', () => {
    const schema = z.object({
      field: z
        .string()
        .min(5, { message: 'first' })
        .regex(/^\d+$/, { message: 'second' }),
    });

    expect(resolve(schema, { field: 'ab' }).errors['field']?.message).toBe(
      'first',
    );
  });

  it('handles an error on a nested path', () => {
    const schema = z.object({
      inner: z.object({ field: z.string().min(1, { message: 'missing' }) }),
    });
    const errors = resolve(schema, { inner: { field: '' } }).errors as Record<
      string,
      Record<string, { message?: string }>
    >;

    expect(errors['inner']?.['field']?.message).toBe('missing');
  });
});
