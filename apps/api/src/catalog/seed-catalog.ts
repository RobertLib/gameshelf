import type { PrismaClient } from '@prisma/client';
import { slugify } from '@gameshelf/contracts';
import { GENRES, PLATFORMS, type PlatformSeed } from './catalog.data';

/**
 * The part of the Prisma client the seed needs. Both `PrismaClient` (the
 * standalone script) and `PrismaService` (the application) satisfy it.
 */
type SeedClient = Pick<PrismaClient, 'platform' | 'genre' | '$transaction'>;

export interface SeedCatalogResult {
  /** How many platforms the lookup table holds afterwards. */
  platforms: number;
  genres: number;
  /** How many rows the seed actually had to write (0 = everything was already in place). */
  written: number;
}

/**
 * Filling the platform and genre lookup tables.
 *
 * A single implementation for both paths the seed is run through: automatically
 * at application startup (`CatalogSeederService`) and manually with the
 * `npm run db:seed` script (`prisma/seed.ts`). These used to be two copies of
 * the same loop, and adding a platform to one of them had no effect on the other.
 *
 * The operation is idempotent, so repeated runs or several instances at once do
 * no harm.
 *
 * It first reads the current state and writes only what really differs. While it
 * was a sequence of unconditional `upsert`s, every single start of the
 * application meant sixty-odd write round-trips that changed nothing - and on
 * SQLite that is sixty-odd commits. Now a warm start costs two reads and stops.
 * Comparing whole rows (not just the presence of a slug) means a renamed
 * platform or a reordered list is still picked up.
 */
export async function seedCatalog(
  prisma: SeedClient,
): Promise<SeedCatalogResult> {
  const desiredPlatforms = PLATFORMS.map((platform, index) => ({
    ...platform,
    sortOrder: index,
  }));
  const desiredGenres = GENRES.map((name, index) => ({
    slug: slugify(name),
    name,
    sortOrder: index,
  }));

  const [existingPlatforms, existingGenres] = await Promise.all([
    prisma.platform.findMany(),
    prisma.genre.findMany(),
  ]);

  const platformBySlug = new Map(existingPlatforms.map((p) => [p.slug, p]));
  const genreBySlug = new Map(existingGenres.map((g) => [g.slug, g]));

  const platformWrites = desiredPlatforms.filter(
    (desired) => !samePlatform(platformBySlug.get(desired.slug), desired),
  );
  const genreWrites = desiredGenres.filter(
    (desired) => !sameGenre(genreBySlug.get(desired.slug), desired),
  );

  const written = platformWrites.length + genreWrites.length;

  if (written > 0) {
    /**
     * One transaction rather than N commits. It also means the lookup tables are
     * never seen half-written by a parallel request - `CatalogService` caches
     * them for five minutes, so a torn read would linger.
     */
    await prisma.$transaction([
      ...platformWrites.map((platform) =>
        prisma.platform.upsert({
          where: { slug: platform.slug },
          create: platform,
          update: platform,
        }),
      ),
      ...genreWrites.map((genre) =>
        prisma.genre.upsert({
          where: { slug: genre.slug },
          create: genre,
          // The slug is the identity, there is nothing to update about it.
          update: { name: genre.name, sortOrder: genre.sortOrder },
        }),
      ),
    ]);
  }

  return {
    platforms: desiredPlatforms.length,
    genres: desiredGenres.length,
    written,
  };
}

/** Is the stored row already exactly what the seed wants? */
function samePlatform(
  stored: (PlatformSeed & { sortOrder: number }) | undefined,
  desired: PlatformSeed & { sortOrder: number },
): boolean {
  return (
    stored !== undefined &&
    stored.name === desired.name &&
    stored.manufacturer === desired.manufacturer &&
    stored.generation === desired.generation &&
    stored.releaseYear === desired.releaseYear &&
    stored.sortOrder === desired.sortOrder
  );
}

function sameGenre(
  stored: { name: string; sortOrder: number } | undefined,
  desired: { name: string; sortOrder: number },
): boolean {
  return (
    stored !== undefined &&
    stored.name === desired.name &&
    stored.sortOrder === desired.sortOrder
  );
}
