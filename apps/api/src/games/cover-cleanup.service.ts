import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  UploadsService,
  UPLOADS_PUBLIC_PATH,
  localFileName,
} from '../uploads/uploads.service';

/**
 * How often the sweep runs.
 *
 * Deliberately not often - it is maintenance, and the files it looks for have to
 * survive `ORPHAN_GRACE_MS` (a day) before they even become candidates. Six
 * hours matches the refresh token cleanup, so the application has one rhythm of
 * background work rather than two.
 */
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Cleanup of covers that no longer belong to anybody.
 *
 * It lives on the collection side rather than in uploads, and that is
 * deliberate: "does anything still point at this file?" is a question about
 * games, not about the disk. As long as the storage itself answered it, it had
 * to query the `game` table - meaning the "uploads" module knew the "games"
 * domain even though the dependency between the modules runs the other way.
 * Uploads can now only accept, validate and delete a file; what counts as
 * rubbish is decided by this code.
 */
@Injectable()
export class CoverCleanupService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(CoverCleanupService.name);

  /** Timer of the periodic sweep; `null` until the application has started. */
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  /**
   * The sweep repeats, it does not only run at startup.
   *
   * Targeted `release()` covers the covers the application knows about - a
   * replaced image and a deleted game. What it cannot catch is an upload that
   * never got attached to anything: `CoverField` sends the file the moment it is
   * picked, so every abandoned form leaves one image behind. Only `purgeOrphans`
   * finds those - and while it ran at startup alone, a container running for
   * months collected them until the next deployment. A restart once a quarter is
   * not a cleanup strategy (the same lesson as in `RefreshTokenService`).
   */
  onApplicationBootstrap(): void {
    void this.runSweep();

    this.sweepTimer = setInterval(
      () => void this.runSweep(),
      SWEEP_INTERVAL_MS,
    );
    // The timer must not keep the process alive - otherwise even the tests
    // would never finish.
    this.sweepTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = null;
  }

  /** The sweep must not take the application down - it is maintenance, not a precondition. */
  private async runSweep(): Promise<void> {
    try {
      await this.purgeOrphans();
    } catch (error) {
      this.logger.warn(`Cleanup of orphaned images failed: ${String(error)}`);
    }
  }

  /**
   * Releases a cover that no game points at any more.
   *
   * It is called after a database write - both when a cover is replaced and when
   * a game is deleted. Without it every image change would leave one file on the
   * disk forever and the storage would grow even when the collection did not.
   *
   * Before deleting we verify that no other record uses the file: the user can
   * paste the same `/uploads/…` into several games by hand. External links are
   * ignored by the storage itself.
   */
  async release(url: string | null | undefined): Promise<void> {
    if (!localFileName(url)) return;

    const stillUsed = await this.prisma.game.count({
      where: { coverImageUrl: url },
    });
    if (stillUsed > 0) return;

    await this.uploads.remove(url);
  }

  /** Sweeps away files no game claims (and which are old enough). */
  async purgeOrphans(): Promise<number> {
    const rows = await this.prisma.game.findMany({
      where: { coverImageUrl: { startsWith: `${UPLOADS_PUBLIC_PATH}/` } },
      select: { coverImageUrl: true },
      distinct: ['coverImageUrl'],
    });

    const referenced = new Set(
      rows.flatMap((row) => {
        const name = localFileName(row.coverImageUrl);
        return name ? [name] : [];
      }),
    );

    return this.uploads.purgeOrphans(referenced);
  }
}
