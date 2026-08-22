import { Injectable } from '@nestjs/common';
import type {
  CreateGameInput,
  Game,
  GameList,
  GameListQuery,
  UpdateGameInput,
} from '@gameshelf/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppErrors } from '../common/errors';
import { CoverCleanupService } from './cover-cleanup.service';
import {
  buildCreateData,
  buildUpdateData,
  gameInclude,
  toGameDto,
  type GameRecord,
} from './game.mapper';
import { buildGameOrderBy, buildGameWhere } from './game-query.builder';

/**
 * A collection is strictly private: every query is scoped to the `userId` of the
 * signed-in user. There is no way to reach somebody else's record - both a
 * "non-existent ID" and "somebody else's ID" end in the same 404, so the API
 * cannot even be used to find out whether a given game exists for another user.
 */
@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly covers: CoverCleanupService,
  ) {}

  async list(userId: string, query: GameListQuery): Promise<GameList> {
    const where = buildGameWhere(userId, query);
    const skip = (query.page - 1) * query.pageSize;

    const [totalItems, records] = await this.prisma.$transaction([
      this.prisma.game.count({ where }),
      this.prisma.game.findMany({
        where,
        include: gameInclude,
        orderBy: buildGameOrderBy(query),
        skip,
        take: query.pageSize,
      }),
    ]);

    const totalPages = Math.ceil(totalItems / query.pageSize);

    return {
      items: records.map(toGameDto),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages,
        hasPrevious: query.page > 1,
        hasNext: query.page < totalPages,
      },
    };
  }

  async getById(userId: string, id: string): Promise<Game> {
    return toGameDto(await this.requireOwned(userId, id));
  }

  async create(userId: string, input: CreateGameInput): Promise<Game> {
    await this.assertReferencesExist(input.platformId, input.genreIds);

    const record = await this.prisma.game.create({
      data: {
        ...buildCreateData(userId, input),
        ...(input.genreIds.length > 0
          ? { genres: { connect: input.genreIds.map((id) => ({ id })) } }
          : {}),
      },
      include: gameInclude,
    });

    return toGameDto(record);
  }

  async update(
    userId: string,
    id: string,
    input: UpdateGameInput,
  ): Promise<Game> {
    const current = await this.requireOwned(userId, id);
    await this.assertReferencesExist(input.platformId, input.genreIds);

    const record = await this.prisma.game.update({
      where: { id: current.id },
      data: {
        ...buildUpdateData(current, input),
        // `set` replaces the whole genre list - an omitted field means "leave unchanged".
        ...(input.genreIds !== undefined
          ? {
              genres: {
                set: input.genreIds.map((genreId) => ({ id: genreId })),
              },
            }
          : {}),
      },
      include: gameInclude,
    });

    // A replaced cover belongs to nobody - otherwise it would stay on disk forever.
    if (record.coverImageUrl !== current.coverImageUrl) {
      await this.covers.release(current.coverImageUrl);
    }

    return toGameDto(record);
  }

  async remove(userId: string, id: string): Promise<void> {
    const current = await this.requireOwned(userId, id);
    await this.prisma.game.delete({ where: { id: current.id } });
    await this.covers.release(current.coverImageUrl);
  }

  /** Loads a game and verifies ownership at the same time - the only path to a record. */
  private async requireOwned(userId: string, id: string): Promise<GameRecord> {
    const record = await this.prisma.game.findFirst({
      where: { id, userId },
      include: gameInclude,
    });
    if (!record) throw AppErrors.gameNotFound();
    return record;
  }

  /**
   * Foreign keys are verified before the database tries them - otherwise the user
   * would get a generic constraint error instead of an understandable message on
   * a specific form field.
   */
  private async assertReferencesExist(
    platformId: string | undefined,
    genreIds: string[] | undefined,
  ): Promise<void> {
    if (platformId !== undefined) {
      const platform = await this.prisma.platform.findUnique({
        where: { id: platformId },
        select: { id: true },
      });
      if (!platform) throw AppErrors.platformNotFound();
    }

    if (genreIds !== undefined && genreIds.length > 0) {
      const found = await this.prisma.genre.findMany({
        where: { id: { in: genreIds } },
        select: { id: true },
      });
      if (found.length !== genreIds.length) {
        const known = new Set(found.map((g) => g.id));
        throw AppErrors.genresNotFound(genreIds.filter((id) => !known.has(id)));
      }
    }
  }
}
