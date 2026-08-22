import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { CollectionOverviewService } from './collection-overview.service';
import { CoverCleanupService } from './cover-cleanup.service';

@Module({
  // For cleaning up covers after a game is replaced or deleted (see CoverCleanupService).
  imports: [UploadsModule],
  controllers: [GamesController],
  providers: [GamesService, CollectionOverviewService, CoverCleanupService],
})
export class GamesModule {}
