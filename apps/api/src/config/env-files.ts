import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loading of the `.env` files.
 *
 * The order is binding and is the only reason this file exists:
 * `process.loadEnvFile` does not overwrite a variable that is already set, so
 * whichever file is loaded first wins. `.env.local` (local deviations of a
 * single machine) therefore has to come before `.env`.
 *
 * Both the application and the Prisma CLI (`prisma.config.ts`) share it. While
 * there were two implementations they had opposite priorities - Prisma took
 * `.env.local`, the application via `@nestjs/config` took `.env`. With an
 * `.env.local` overriding `DATABASE_URL`, `db:migrate` then touched one database
 * while the application ran against another; exactly the kind of bug nobody
 * looks for in the configuration.
 *
 * Real environment variables take precedence over both files, so neither the
 * container nor the tests have to care about what sits in the repository.
 */
export const ENV_FILES = ['.env.local', '.env'] as const;

export function loadEnvFiles(baseDir: string = process.cwd()): void {
  for (const file of ENV_FILES) {
    const path = resolve(baseDir, file);
    if (existsSync(path)) process.loadEnvFile(path);
  }
}
