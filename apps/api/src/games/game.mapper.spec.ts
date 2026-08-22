import {
  createGameSchema,
  maxReleaseYear,
  updateGameSchema,
} from '@gameshelf/contracts';
import {
  buildCreateData,
  buildUpdateData,
  derivedColumns,
  fromMinorUnits,
  toMinorUnits,
  writableFields,
  type GameRecord,
} from './game.mapper';

describe('money in smallest units', () => {
  it('rounds to whole cents and returns the exact value back', () => {
    expect(toMinorUnits(2490.5)).toBe(249050);
    expect(toMinorUnits(0.1 + 0.2)).toBe(30);
    expect(fromMinorUnits(249050)).toBe(2490.5);
  });

  it('sums prices without floating point error', () => {
    const total = [10.1, 20.2, 30.3].reduce(
      (sum, p) => sum + toMinorUnits(p),
      0,
    );
    expect(fromMinorUnits(total)).toBe(60.6);
  });
});

describe('derivedColumns', () => {
  const base = {
    developer: null,
    publisher: null,
    edition: null,
    barcode: null,
    notes: null,
    storageLocation: null,
    releaseYear: null,
    condition: 'GOOD' as const,
  };

  it('strips both the article and the diacritics from the sort key', () => {
    expect(derivedColumns({ ...base, title: 'The Pokémon' }).sortTitle).toBe(
      'pokemon',
    );
  });

  it('puts every searchable field into the search index', () => {
    const { searchIndex } = derivedColumns({
      ...base,
      title: 'Gran Turismo 4',
      developer: 'Polyphony Digital',
      publisher: 'Sony',
      releaseYear: 2004,
    });

    expect(searchIndex).toContain('gran turismo 4');
    expect(searchIndex).toContain('polyphony digital');
    expect(searchIndex).toContain('2004');
  });

  it('translates the condition into a numeric weight for sorting', () => {
    expect(
      derivedColumns({ ...base, title: 'x', condition: 'MINT' }).conditionRank,
    ).toBeGreaterThan(
      derivedColumns({ ...base, title: 'x', condition: 'POOR' }).conditionRank,
    );
  });
});

describe('buildCreateData', () => {
  it('fills in the defaults and converts the price', () => {
    const input = createGameSchema.parse({
      title: '  Half-Life  ',
      platformId: 'pc',
      purchasePrice: '349,50',
    });

    const data = buildCreateData('user-1', input);

    expect(data).toMatchObject({
      userId: 'user-1',
      title: 'Half-Life',
      sortTitle: 'half-life',
      region: 'PAL',
      condition: 'GOOD',
      quantity: 1,
      purchasePriceMinor: 34950,
      developer: null,
    });
  });
});

describe('buildUpdateData', () => {
  const current = {
    id: 'g1',
    title: 'Gran Turismo 4',
    developer: 'Polyphony Digital',
    publisher: 'Sony',
    edition: null,
    barcode: null,
    notes: null,
    storageLocation: null,
    releaseYear: 2004,
    condition: 'GOOD',
  } as unknown as GameRecord;

  it('recomputes the search index even when a single field changes', () => {
    const data = buildUpdateData(
      current,
      updateGameSchema.parse({ publisher: 'Sony Computer Entertainment' }),
    );

    expect(data.searchIndex).toContain('sony computer entertainment');
    // Unchanged fields have to stay in the index.
    expect(data.searchIndex).toContain('gran turismo 4');
    expect(data.title).toBeUndefined();
  });

  it('does not push an omitted field into the database, but an explicit null yes', () => {
    const data = buildUpdateData(
      current,
      updateGameSchema.parse({ notes: null }),
    );

    expect(data.notes).toBeNull();
    expect(data.publisher).toBeUndefined();
  });

  it('updates the numeric weight as well when the condition changes', () => {
    const data = buildUpdateData(
      current,
      updateGameSchema.parse({ condition: 'MINT' }),
    );

    expect(data.condition).toBe('MINT');
    expect(data.conditionRank).toBe(5);
  });
});

/**
 * `buildCreateData` asserts to the type system that the column map yields a
 * complete set. An assertion without a check is just a polite lie, so
 * completeness is guarded by these two tests: the first compares the map against
 * the schema, the second the resulting object against the list of table columns.
 * A forgotten field therefore fails here, not by silently not storing data.
 */
describe('completeness of the column map', () => {
  it('covers every writable field of the contract', () => {
    const contractFields = Object.keys(createGameSchema.shape)
      .filter((field) => field !== 'genreIds')
      .sort();

    expect([...writableFields].sort()).toEqual(contractFields);
  });

  it('assembles every table column from a full input', () => {
    const data = buildCreateData(
      'user-1',
      createGameSchema.parse({ title: 'Game', platformId: 'p1' }),
    );

    expect(Object.keys(data).sort()).toEqual(
      [
        'barcode',
        'completeness',
        'condition',
        'conditionRank',
        'coverImageUrl',
        'developer',
        'edition',
        'estimatedValueMinor',
        'isFavorite',
        'notes',
        'platformId',
        'publisher',
        'purchaseCurrency',
        'purchaseDate',
        'purchasePriceMinor',
        'purchasedFrom',
        'quantity',
        'rating',
        'region',
        'releaseYear',
        'searchIndex',
        'sortTitle',
        'status',
        'storageLocation',
        'title',
        'userId',
      ].sort(),
    );
  });
});

/**
 * The purchase date used to be checked for format only, so a mistyped year
 * (9999, or 202 instead of 2024) was stored and then parked the game at one end
 * of every date-sorted list forever.
 */
describe('purchaseDate bounds', () => {
  const parseDate = (purchaseDate: string) =>
    updateGameSchema.safeParse({ purchaseDate });

  const isoDay = (offsetDays: number) =>
    new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

  it('accepts a plausible date', () => {
    expect(parseDate('2019-04-30').success).toBe(true);
  });

  it('accepts today', () => {
    expect(parseDate(isoDay(0)).success).toBe(true);
  });

  it('rejects a date in the future', () => {
    expect(parseDate(isoDay(30)).success).toBe(false);
    expect(parseDate('9999-01-01').success).toBe(false);
  });

  it('rejects a date before games existed', () => {
    expect(parseDate('1969-12-31').success).toBe(false);
    expect(parseDate('0202-01-01').success).toBe(false);
  });

  /** An empty value is "not filled in", not an invalid date. */
  it('still treats an empty value as null', () => {
    const result = updateGameSchema.safeParse({ purchaseDate: '' });
    expect(result.success).toBe(true);
    expect(result.data?.purchaseDate).toBeNull();
  });
});

/**
 * The release-year ceiling has to be read when the value is validated, not when
 * the schema is built.
 *
 * As a module-load constant it was frozen: a server process running over New
 * Year's Eve kept offering the previous year's ceiling, and in the browser it
 * froze even earlier - at build time - so the form could refuse a year the API
 * accepted. This does not test the calendar, it tests that the bound is a live
 * one: `maxReleaseYear()` is evaluated here, now, and the schema has to agree.
 */
describe('releaseYear bounds', () => {
  const parseYear = (releaseYear: unknown) =>
    updateGameSchema.safeParse({ releaseYear });

  it('accepts the current ceiling', () => {
    expect(parseYear(maxReleaseYear()).success).toBe(true);
  });

  it('rejects the year just above it', () => {
    expect(parseYear(maxReleaseYear() + 1).success).toBe(false);
  });

  it('rejects a year from before games existed', () => {
    expect(parseYear(1969).success).toBe(false);
  });

  /** An empty field is "not filled in", not an invalid year. */
  it('still treats an empty value as null', () => {
    const result = updateGameSchema.safeParse({ releaseYear: '' });
    expect(result.success).toBe(true);
    expect(result.data?.releaseYear).toBeNull();
  });
});
