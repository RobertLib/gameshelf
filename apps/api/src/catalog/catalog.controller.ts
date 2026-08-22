import { Controller } from '@nestjs/common';
import { contract, type Output } from '@gameshelf/contracts';
import { Endpoint } from '../common/http/endpoint.decorator';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Endpoint(contract.catalog.get)
  get(): Promise<Output<typeof contract.catalog.get>> {
    return this.catalog.getCatalog();
  }
}
