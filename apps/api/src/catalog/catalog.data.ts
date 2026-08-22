/**
 * The contents of the platform and genre lookup tables.
 *
 * It is a plain data file with no dependency on Prisma, so that both the seeder
 * that runs at application startup and the standalone `npm run db:seed` script
 * can use it.
 */

export interface PlatformSeed {
  slug: string;
  name: string;
  manufacturer: string | null;
  generation: number | null;
  releaseYear: number | null;
}

/** The order is also the order in the picker: the most common platforms on top. */
export const PLATFORMS: PlatformSeed[] = [
  {
    slug: 'pc',
    name: 'PC',
    manufacturer: null,
    generation: null,
    releaseYear: null,
  },
  {
    slug: 'ps5',
    name: 'PlayStation 5',
    manufacturer: 'Sony',
    generation: 9,
    releaseYear: 2020,
  },
  {
    slug: 'ps4',
    name: 'PlayStation 4',
    manufacturer: 'Sony',
    generation: 8,
    releaseYear: 2013,
  },
  {
    slug: 'ps3',
    name: 'PlayStation 3',
    manufacturer: 'Sony',
    generation: 7,
    releaseYear: 2006,
  },
  {
    slug: 'ps2',
    name: 'PlayStation 2',
    manufacturer: 'Sony',
    generation: 6,
    releaseYear: 2000,
  },
  {
    slug: 'ps1',
    name: 'PlayStation',
    manufacturer: 'Sony',
    generation: 5,
    releaseYear: 1994,
  },
  {
    slug: 'psp',
    name: 'PlayStation Portable',
    manufacturer: 'Sony',
    generation: 7,
    releaseYear: 2004,
  },
  {
    slug: 'ps-vita',
    name: 'PlayStation Vita',
    manufacturer: 'Sony',
    generation: 8,
    releaseYear: 2011,
  },

  {
    slug: 'xbox-series',
    name: 'Xbox Series X|S',
    manufacturer: 'Microsoft',
    generation: 9,
    releaseYear: 2020,
  },
  {
    slug: 'xbox-one',
    name: 'Xbox One',
    manufacturer: 'Microsoft',
    generation: 8,
    releaseYear: 2013,
  },
  {
    slug: 'xbox-360',
    name: 'Xbox 360',
    manufacturer: 'Microsoft',
    generation: 7,
    releaseYear: 2005,
  },
  {
    slug: 'xbox',
    name: 'Xbox',
    manufacturer: 'Microsoft',
    generation: 6,
    releaseYear: 2001,
  },

  {
    slug: 'switch-2',
    name: 'Nintendo Switch 2',
    manufacturer: 'Nintendo',
    generation: 9,
    releaseYear: 2025,
  },
  {
    slug: 'switch',
    name: 'Nintendo Switch',
    manufacturer: 'Nintendo',
    generation: 8,
    releaseYear: 2017,
  },
  {
    slug: 'wii-u',
    name: 'Wii U',
    manufacturer: 'Nintendo',
    generation: 8,
    releaseYear: 2012,
  },
  {
    slug: 'wii',
    name: 'Wii',
    manufacturer: 'Nintendo',
    generation: 7,
    releaseYear: 2006,
  },
  {
    slug: 'gamecube',
    name: 'GameCube',
    manufacturer: 'Nintendo',
    generation: 6,
    releaseYear: 2001,
  },
  {
    slug: 'n64',
    name: 'Nintendo 64',
    manufacturer: 'Nintendo',
    generation: 5,
    releaseYear: 1996,
  },
  {
    slug: 'snes',
    name: 'Super Nintendo (SNES)',
    manufacturer: 'Nintendo',
    generation: 4,
    releaseYear: 1990,
  },
  {
    slug: 'nes',
    name: 'Nintendo (NES)',
    manufacturer: 'Nintendo',
    generation: 3,
    releaseYear: 1983,
  },
  {
    slug: 'n3ds',
    name: 'Nintendo 3DS',
    manufacturer: 'Nintendo',
    generation: 8,
    releaseYear: 2011,
  },
  {
    slug: 'nds',
    name: 'Nintendo DS',
    manufacturer: 'Nintendo',
    generation: 7,
    releaseYear: 2004,
  },
  {
    slug: 'gba',
    name: 'Game Boy Advance',
    manufacturer: 'Nintendo',
    generation: 6,
    releaseYear: 2001,
  },
  {
    slug: 'gbc',
    name: 'Game Boy Color',
    manufacturer: 'Nintendo',
    generation: 5,
    releaseYear: 1998,
  },
  {
    slug: 'game-boy',
    name: 'Game Boy',
    manufacturer: 'Nintendo',
    generation: 4,
    releaseYear: 1989,
  },

  {
    slug: 'dreamcast',
    name: 'Dreamcast',
    manufacturer: 'Sega',
    generation: 6,
    releaseYear: 1998,
  },
  {
    slug: 'saturn',
    name: 'Sega Saturn',
    manufacturer: 'Sega',
    generation: 5,
    releaseYear: 1994,
  },
  {
    slug: 'mega-drive',
    name: 'Mega Drive / Genesis',
    manufacturer: 'Sega',
    generation: 4,
    releaseYear: 1988,
  },
  {
    slug: 'master-system',
    name: 'Master System',
    manufacturer: 'Sega',
    generation: 3,
    releaseYear: 1985,
  },
  {
    slug: 'game-gear',
    name: 'Game Gear',
    manufacturer: 'Sega',
    generation: 4,
    releaseYear: 1990,
  },

  {
    slug: 'amiga',
    name: 'Amiga',
    manufacturer: 'Commodore',
    generation: null,
    releaseYear: 1985,
  },
  {
    slug: 'c64',
    name: 'Commodore 64',
    manufacturer: 'Commodore',
    generation: null,
    releaseYear: 1982,
  },
  {
    slug: 'zx-spectrum',
    name: 'ZX Spectrum',
    manufacturer: 'Sinclair',
    generation: null,
    releaseYear: 1982,
  },
  {
    slug: 'atari-2600',
    name: 'Atari 2600',
    manufacturer: 'Atari',
    generation: 2,
    releaseYear: 1977,
  },
  {
    slug: 'atari-st',
    name: 'Atari ST',
    manufacturer: 'Atari',
    generation: null,
    releaseYear: 1985,
  },
  {
    slug: 'neo-geo',
    name: 'Neo Geo',
    manufacturer: 'SNK',
    generation: 4,
    releaseYear: 1990,
  },
  {
    slug: 'steam-deck',
    name: 'Steam Deck',
    manufacturer: 'Valve',
    generation: null,
    releaseYear: 2022,
  },
  {
    slug: 'other',
    name: 'Other platform',
    manufacturer: null,
    generation: null,
    releaseYear: null,
  },
];

export const GENRES: string[] = [
  'Action',
  'Adventure',
  'Action-adventure',
  'RPG',
  'JRPG',
  'Shooter (FPS)',
  'Shooter (TPS)',
  'Platformer',
  'Strategy',
  'Turn-based strategy',
  'City builder',
  'Simulation',
  'Racing',
  'Sports',
  'Fighting',
  'Puzzle',
  'Music / rhythm',
  'Horror',
  'Stealth',
  'Metroidvania',
  'Roguelike',
  'Point & click',
  'Visual novel',
  'MMO',
  'Party game',
  'Educational',
];
