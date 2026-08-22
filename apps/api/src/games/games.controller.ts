import { Controller, Param } from '@nestjs/common';
import {
  contract,
  type CreateGameInput,
  type GameListQuery,
  type Output,
  type UpdateGameInput,
} from '@gameshelf/contracts';
import {
  ContractBody,
  ContractQuery,
  Endpoint,
} from '../common/http/endpoint.decorator';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/auth/current-user';
import { GamesService } from './games.service';
import { CollectionOverviewService } from './collection-overview.service';

@Controller()
export class GamesController {
  constructor(
    private readonly games: GamesService,
    private readonly overview: CollectionOverviewService,
  ) {}

  /**
   * Has to stay above `getById` - Nest matches routes in declaration order and
   * `games/:id` would otherwise swallow `games/overview` as well.
   */
  @Endpoint(contract.games.overview)
  getOverview(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Output<typeof contract.games.overview>> {
    return this.overview.getOverview(user.id);
  }

  @Endpoint(contract.games.list)
  list(
    @CurrentUser() user: AuthenticatedUser,
    @ContractQuery(contract.games.list) query: GameListQuery,
  ): Promise<Output<typeof contract.games.list>> {
    return this.games.list(user.id, query);
  }

  @Endpoint(contract.games.getById)
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<Output<typeof contract.games.getById>> {
    return this.games.getById(user.id, id);
  }

  @Endpoint(contract.games.create)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @ContractBody(contract.games.create) body: CreateGameInput,
  ): Promise<Output<typeof contract.games.create>> {
    return this.games.create(user.id, body);
  }

  @Endpoint(contract.games.update)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @ContractBody(contract.games.update) body: UpdateGameInput,
  ): Promise<Output<typeof contract.games.update>> {
    return this.games.update(user.id, id, body);
  }

  @Endpoint(contract.games.remove)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<Output<typeof contract.games.remove>> {
    await this.games.remove(user.id, id);
    return { ok: true };
  }
}
