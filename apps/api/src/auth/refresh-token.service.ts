import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { APP_CONFIG, type AppConfig } from '../config/env';
import { AppErrors } from '../common/errors';

/**
 * How often the cleanup runs. It is not meant to be often - this is maintenance,
 * not precision.
 */
const PURGE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * How long an already spent or revoked token is kept.
 *
 * It is not just rubbish to be thrown away: as long as the row exists, a replay
 * can be recognized by it and the whole family revoked. Once deleted, a stolen
 * token would end up as "unknown" - rejected too, but without terminating the
 * rest of the session. A week is the compromise between that and a table that
 * would otherwise hold every fifteen-minute rotation step for a full thirty
 * days.
 */
const SPENT_TOKEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface IssuedRefreshToken {
  /** The plaintext token - the only place the application sees it. It belongs in the cookie. */
  token: string;
  expiresAt: Date;
}

/**
 * Refresh tokens with rotation and replay detection.
 *
 * The rules:
 *  - only a SHA-256 fingerprint is stored in the database, never the token,
 *  - every refresh spends the token and issues a new one (rotation),
 *  - using an already spent token means somebody stole it -> the whole token
 *    "family", that is the whole compromised session, is revoked,
 *  - a family carries an absolute deadline that rotation cannot push
 *    (`familyExpiresAt`), so a session has a longest possible life.
 *
 * The token is 48 bytes from a CSPRNG, so SHA-256 is enough for the fingerprint
 * - unlike with passwords there is nothing here to brute-force.
 */
@Injectable()
export class RefreshTokenService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RefreshTokenService.name);

  /** Timer of the periodic cleanup; `null` until the application has started. */
  private purgeTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * The cleanup runs repeatedly, not only at startup.
   *
   * While it was called from `main.ts` alone, a container last cleaned up at
   * deployment time - and the table then only grew for months, because rotation
   * produces a new row every fifteen minutes of active work. A restart once a
   * quarter is not a cleanup strategy.
   */
  onApplicationBootstrap(): void {
    void this.runPurge();

    this.purgeTimer = setInterval(
      () => void this.runPurge(),
      PURGE_INTERVAL_MS,
    );
    // The timer must not keep the process alive - otherwise even the tests
    // would never finish.
    this.purgeTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.purgeTimer) clearInterval(this.purgeTimer);
    this.purgeTimer = null;
  }

  /** Issues the first token of a new session - and with it the family's deadline. */
  async issue(userId: string, userAgent?: string): Promise<IssuedRefreshToken> {
    const { token, data } = this.prepare({
      userId,
      familyId: randomUUID(),
      familyExpiresAt: new Date(
        Date.now() + daysToMs(this.config.auth.refreshAbsoluteTtlDays),
      ),
      userAgent,
    });
    await this.prisma.refreshToken.create({ data });
    return { token, expiresAt: data.expiresAt };
  }

  /**
   * Spends a token and issues a new one in the same family.
   * @throws if the token is unknown, expired, revoked or already used once
   */
  async rotate(
    rawToken: string,
    userAgent?: string,
  ): Promise<{ userId: string; issued: IssuedRefreshToken }> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: fingerprint(rawToken) },
    });

    if (!record) throw AppErrors.refreshTokenInvalid();

    if (record.usedAt || record.revokedAt) {
      // A replay means the token leaked. The whole family is put on ice.
      await this.revokeFamily(record.familyId);
      this.logger.warn(
        `Refresh token replay detected (user ${record.userId}) - the session has been revoked.`,
      );
      throw AppErrors.refreshTokenInvalid();
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw AppErrors.refreshTokenInvalid();
    }

    const { token, data } = this.prepare({
      userId: record.userId,
      familyId: record.familyId,
      /**
       * The family's deadline is carried over, never recomputed - that is the
       * whole point of it. `null` is a token issued before absolute caps
       * existed; it starts its window now rather than being rejected, so a
       * deployment does not sign everybody out.
       */
      familyExpiresAt:
        record.familyExpiresAt ??
        new Date(
          Date.now() + daysToMs(this.config.auth.refreshAbsoluteTtlDays),
        ),
      userAgent,
    });

    /**
     * Spending the old token has to be conditional, not merely wrapped in a
     * transaction. The `record.usedAt` check above ran on a *read* copy - two
     * concurrent requests (two browser tabs) would both slip past it and turn
     * one session into two. The `usedAt: null` condition moves the decision into
     * the database: exactly one write succeeds, and whoever loses gets the same
     * error as with an invalid token.
     */
    const claimed = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: record.id, usedAt: null, revokedAt: null },
        data: { usedAt: new Date() },
      });
      if (count === 0) return false;

      await tx.refreshToken.create({ data });
      return true;
    });

    if (!claimed) throw AppErrors.refreshTokenInvalid();

    return {
      userId: record.userId,
      issued: { token, expiresAt: data.expiresAt },
    };
  }

  /** Signs out a single session. */
  async revoke(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: fingerprint(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Signs out every session of a user (e.g. after a password change). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Deletes tokens that are of no use any more: expired ones, and spent or
   * revoked ones that are old enough (see `SPENT_TOKEN_RETENTION_MS`).
   */
  async purge(): Promise<number> {
    const now = new Date();
    const spentBefore = new Date(now.getTime() - SPENT_TOKEN_RETENTION_MS);

    const { count } = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { usedAt: { lt: spentBefore } },
          { revokedAt: { lt: spentBefore } },
        ],
      },
    });
    return count;
  }

  /** The cleanup must not take the application down - it is maintenance, not a precondition. */
  private async runPurge(): Promise<void> {
    try {
      const removed = await this.purge();
      if (removed > 0) {
        this.logger.log(`Purged ${removed} obsolete refresh tokens`);
      }
    } catch (error) {
      this.logger.warn(`Refresh token cleanup failed: ${String(error)}`);
    }
  }

  /**
   * Produces the pair "plaintext token + row to store". The caller thus gets the
   * token in hand without it ever leaving the process memory other than through
   * the cookie.
   *
   * The expiry is the **earlier** of the idle timeout and the family's deadline.
   * That single `Math.min` is what turns the cap into something real: once the
   * deadline is closer than the idle window, every further token is born already
   * shorter, and the last one expires exactly on the deadline. `rotate` then
   * rejects it through the ordinary expiry check - no separate branch needed.
   */
  private prepare(params: {
    userId: string;
    familyId: string;
    familyExpiresAt: Date;
    userAgent?: string;
  }): {
    token: string;
    data: Prisma.RefreshTokenUncheckedCreateInput & { expiresAt: Date };
  } {
    const token = randomBytes(48).toString('base64url');
    const idleExpiry = Date.now() + daysToMs(this.config.auth.refreshTtlDays);

    return {
      token,
      data: {
        userId: params.userId,
        familyId: params.familyId,
        tokenHash: fingerprint(token),
        expiresAt: new Date(
          Math.min(idleExpiry, params.familyExpiresAt.getTime()),
        ),
        familyExpiresAt: params.familyExpiresAt,
        userAgent: params.userAgent?.slice(0, 255) ?? null,
      },
    };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

/** SHA-256 fingerprint of the token - the only thing stored in the database. */
function fingerprint(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

function daysToMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}
