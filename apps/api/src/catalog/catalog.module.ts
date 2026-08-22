import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogSeederService } from './catalog-seeder.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, CatalogSeederService],
  exports: [CatalogService, CatalogSeederService],
})
export class CatalogModule {}
