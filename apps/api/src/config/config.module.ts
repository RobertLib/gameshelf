import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from './env';
import { loadEnvFiles } from './env-files';

/**
 * `.env` is loaded when the module is imported, not in the DI factory.
 *
 * The Prisma client reads the connection string from `process.env` in its
 * constructor, so if the files were only loaded while `APP_CONFIG` was being
 * created, it would matter which provider Nest instantiates first. At this level
 * the order is given by the order of imports in `app.module.ts`, and
 * `@nestjs/config` (which used to be here) worked exactly the same way.
 */
loadEnvFiles();

/**
 * Exposes the validated, typed configuration.
 *
 * The rest of the application injects `APP_CONFIG` and never reads
 * `process.env` - that way everything the application takes from the
 * environment is visible in one place.
 *
 * `@nestjs/config` used to be here only for a single `.env` load, but it gave
 * the files the opposite priority to the Prisma CLI (see `env-files.ts`), so the
 * whole package was replaced by the native `process.loadEnvFile`.
 */
@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: () => loadConfig(),
    },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
