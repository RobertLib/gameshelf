import { Injectable } from '@nestjs/common';
import type { Catalog } from '@gameshelf/contracts';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * The platform and genre lookup tables.
 *
 * The data changes roughly once a year but is read every time a form or a filter
 * is opened - which is why we keep it in the process memory. The frontend
 * additionally caches it browser-side through TanStack Query.
 */
@Injectable()
export class CatalogService {
  private cache: { value: Catalog; expiresAt: number } | null = null;

  private static readonly TTL_MS = 5 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  async getCatalog(): Promise<Catalog> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.value;
    }

    const [platforms, genres] = await this.prisma.$transaction([
      this.prisma.platform.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.genre.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    ]);

    const value: Catalog = {
      platforms: platforms.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        manufacturer: p.manufacturer,
        generation: p.generation,
        releaseYear: p.releaseYear,
      })),
      genres: genres.map((g) => ({ id: g.id, slug: g.slug, name: g.name })),
    };

    this.cache = { value, expiresAt: Date.now() + CatalogService.TTL_MS };
    return value;
  }

  /** Invalidates the cache - called after a seed or a change to the lookup tables. */
  invalidate(): void {
    this.cache = null;
  }
}
