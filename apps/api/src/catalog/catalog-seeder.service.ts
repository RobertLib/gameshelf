import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { APP_CONFIG, type AppConfig } from '../config/env';
import { CatalogService } from './catalog.service';
import { seedCatalog, type SeedCatalogResult } from './seed-catalog';

/**
 * Filling the platform and genre lookup tables.
 *
 * It runs at application startup, not as a separate deployment step. Without
 * platforms not a single game could be added - a freshly deployed instance would
 * be unusable until somebody ran the seed by hand. The operation is idempotent
 * (upsert by slug), so repeated starts or several instances do no harm.
 */
@Injectable()
export class CatalogSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogSeederService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.seedCatalogOnStart) return;
    await this.seed();
  }

  async seed(): Promise<SeedCatalogResult> {
    const result = await seedCatalog(this.prisma);

    // The lookup tables are held in memory; the cache must be dropped after a
    // write. With nothing written there is nothing to drop - and throwing the
    // cache away on every start would only mean the first request after it pays
    // for the reload.
    if (result.written > 0) this.catalog.invalidate();

    this.logger.log(
      `Lookup tables ready: ${result.platforms} platforms, ${result.genres} genres` +
        (result.written > 0
          ? ` (${result.written} rows written)`
          : ' (already up to date)'),
    );
    return result;
  }
}
