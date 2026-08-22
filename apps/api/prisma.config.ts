/**
 * Prisma CLI configuration.
 *
 * Replaces the `package.json#prisma` section, which Prisma 7 will no longer
 * read. Note: with a config file present Prisma does not load `.env` on its own,
 * hence `loadEnvFiles` below. It is the very same function the application uses,
 * so migrations and the running API look at the same database.
 */
import { join } from 'node:path';
import { defineConfig } from 'prisma/config';
import { loadEnvFiles } from './src/config/env-files';

// `__dirname`, not `process.cwd()` - the Prisma CLI can also be run from the
// monorepo root with `--schema`, and `.env` belongs to the API, not to the
// place it was launched from.
loadEnvFiles(__dirname);

export default defineConfig({
  schema: join('prisma', 'schema.prisma'),
  migrations: {
    path: join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
