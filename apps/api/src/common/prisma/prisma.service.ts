import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { APP_CONFIG, type AppConfig } from '../../config/env';

/**
 * The levels Prisma emits as events.
 *
 * It is a literal type on purpose: `PrismaClient` derives from it what may be
 * passed to `$on`. If the array were assembled at runtime (say by a ternary
 * based on the environment), `$on` would only offer `beforeExit` and the
 * subscription would not compile. Filtering by environment is therefore done by
 * the listener itself.
 */
type PrismaLogOptions = {
  log: [{ emit: 'event'; level: 'warn' }, { emit: 'event'; level: 'error' }];
};

/**
 * A thin wrapper around the Prisma client tied to the Nest lifecycle. The rest
 * of the application works with `PrismaService`, so a possible ORM swap has a
 * single focal point.
 *
 * It takes its configuration from `APP_CONFIG`, not from `process.env`. Besides
 * keeping the promise that "the environment is read in one place", that also
 * creates a DI dependency: the validated configuration (and with it the loaded
 * `.env`) therefore exists before the Prisma client is constructed.
 */
@Injectable()
export class PrismaService
  extends PrismaClient<PrismaLogOptions>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    this.forwardLogsToNest();

    await this.$connect();
    // On SQLite Prisma enables foreign key checks itself on every connection.
    // WAL, on the other hand, we switch on by hand - it is a property of the
    // file, so once is enough and it buys concurrent reads during a write.
    // PRAGMA returns a row, hence $queryRaw and not $executeRaw.
    if (this.isSqlite()) {
      await this.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    }
    this.logger.log('Connected to the database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    // The counterpart of the connection message: the log then shows the
    // difference between an orderly shutdown and a crashed process. Assumes
    // `enableShutdownHooks` in `main.ts`.
    this.logger.log('Disconnected from the database');
  }

  /**
   * Without this wiring, Prisma's messages would go nowhere.
   *
   * `emit: 'event'` means "emit it **only** as an event" - nothing reaches
   * stdout in that mode. As long as nobody subscribed, database errors vanished
   * without a trace: not a single line in the log said anything had failed. We
   * keep warnings in development only, errors always.
   */
  private forwardLogsToNest(): void {
    this.$on('error', (event) => {
      this.logger.error(event.message, event.target);
    });

    if (this.config.nodeEnv === 'development') {
      this.$on('warn', (event) => {
        this.logger.warn(`${event.message} (${event.target})`);
      });
    }
  }

  private isSqlite(): boolean {
    return this.config.databaseUrl.startsWith('file:');
  }
}
