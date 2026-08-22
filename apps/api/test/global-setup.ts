import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Prepares an isolated database for the e2e tests.
 *
 * Every run gets its own SQLite file in a temporary directory, so the tests
 * never touch development data and do not have to clean up after themselves. The
 * environment variables set here are inherited by the test process too - `.env`
 * does not override them, because already existing values take precedence.
 */
export default function globalSetup(): void {
  const workDir = mkdtempSync(join(tmpdir(), 'gameshelf-e2e-'));

  process.env['NODE_ENV'] = 'test';
  process.env['DATABASE_URL'] = `file:${join(workDir, 'e2e.db')}`;
  process.env['UPLOADS_DIR'] = join(workDir, 'uploads');
  process.env['JWT_ACCESS_SECRET'] = 'e2e-secret-e2e-secret-e2e-secret-e2e!';
  process.env['ENABLE_SWAGGER'] = 'false';
  // Request limits would fail spuriously during a fast test run.
  process.env['THROTTLE_LIMIT'] = '100000';

  const run = (command: string, args: string[]): void => {
    execFileSync(command, args, { stdio: 'inherit', env: process.env });
  };

  run('npx', ['prisma', 'migrate', 'deploy']);
  run('npx', ['tsx', 'prisma/seed.ts']);
}
