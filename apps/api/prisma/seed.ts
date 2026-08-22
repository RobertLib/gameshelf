/**
 * Manual seeding of the lookup tables: `npm run db:seed`.
 *
 * The application fills the lookup tables itself at startup (see
 * `src/catalog/catalog-seeder.service.ts`); this script is for the cases where
 * they need to be restored without running the whole API - typically after
 * `prisma migrate reset`. The seeding itself is done by `seedCatalog`, so both
 * paths share a single implementation.
 */
import { PrismaClient } from '@prisma/client';
import { seedCatalog } from '../src/catalog/seed-catalog';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding the platform and genre lookup tables…');
  const { written } = await seedCatalog(prisma);

  const [platforms, genres] = await Promise.all([
    prisma.platform.count(),
    prisma.genre.count(),
  ]);
  console.log(
    `Done: ${platforms} platforms, ${genres} genres` +
      (written > 0 ? ` (${written} rows written).` : ' (already up to date).'),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
