import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  ThrottlerStorage,
  type ThrottlerStorageService,
} from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { API_PREFIX, REFRESH_COOKIE_NAME } from '@gameshelf/contracts';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { APP_CONFIG, type AppConfig } from '../src/config/env';
import { PrismaService } from '../src/common/prisma/prisma.service';

/**
 * An end-to-end walk through the application: registration -> catalog -> CRUD
 * -> filters.
 *
 * It is tested over HTTP against the assembled Nest container, so the guards,
 * the pipes, the exception filter and the validation of responses against the
 * contracts are exercised too - exactly the layers a unit test does not catch.
 */
describe('GameShelf API (e2e)', () => {
  let app: INestApplication;
  let http: App;
  let prisma: PrismaService;
  let throttlerStorage: ThrottlerStorageService;
  let uploadsDir: string;

  const api = (path: string) => `${API_PREFIX}/${path}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // The same setup as in main.ts - the tests therefore verify the production
    // configuration, not their own approximate copy. The exception filter and the
    // response interceptor are supplied by AppModule via APP_FILTER /
    // APP_INTERCEPTOR.
    const nestApp = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(nestApp, nestApp.get<AppConfig>(APP_CONFIG));
    app = nestApp;

    await app.init();

    http = app.getHttpServer() as App;
    prisma = app.get(PrismaService);
    // The storage is provided under the `ThrottlerStorage` symbol, not the class.
    throttlerStorage = app.get<ThrottlerStorageService>(ThrottlerStorage);
    uploadsDir = app.get<AppConfig>(APP_CONFIG).uploadsDir;
  });

  afterAll(async () => {
    await app.close();
  });

  /** A clean state for every test - deleting users cascades to their games. */
  beforeEach(async () => {
    await prisma.user.deleteMany();
    /**
     * The rate limit counters live in memory across the whole file. Registration
     * is called in almost every test, so without this cleanup the suite would hit
     * the (correctly working) limit of 10 registrations per minute and fail with
     * 429. The limits themselves are tested deliberately in `authentication`.
     */
    throttlerStorage.storage.clear();
  });

  async function registerUser(email = 'collector@example.com') {
    const response = await request(http)
      .post(api('auth/register'))
      .send({ email, password: 'secretpassword123', displayName: 'Collector' })
      .expect(201);

    return {
      token: response.body.accessToken as string,
      userId: response.body.user.id as string,
      cookies: response.headers['set-cookie'] as unknown as string[],
    };
  }

  async function platformId(slug = 'ps2'): Promise<string> {
    const platform = await prisma.platform.findUniqueOrThrow({
      where: { slug },
    });
    return platform.id;
  }

  describe('authentication', () => {
    it('registers a user and returns the refresh token only in an httpOnly cookie', async () => {
      const { cookies } = await registerUser();
      const refreshCookie = cookies.find((c) =>
        c.startsWith(`${REFRESH_COOKIE_NAME}=`),
      );

      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('SameSite=Lax');
    });

    it('normalizes the email so that letter case does not create a second account', async () => {
      await registerUser('Collector@Example.COM');

      await request(http)
        .post(api('auth/register'))
        .send({
          email: 'collector@example.com',
          password: 'secretpassword123',
          displayName: 'Someone else',
        })
        .expect(409)
        .expect((res) => expect(res.body.code).toBe('EMAIL_TAKEN'));
    });

    it('returns per-field errors, not just a generic message', async () => {
      const response = await request(http)
        .post(api('auth/register'))
        .send({ email: 'invalid', password: 'short', displayName: 'A' })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
      expect(Object.keys(response.body.fieldErrors).sort()).toEqual([
        'displayName',
        'email',
        'password',
      ]);
    });

    it('does not tell a non-existent account apart from a wrong password', async () => {
      await registerUser();

      const wrongPassword = await request(http)
        .post(api('auth/login'))
        .send({
          email: 'collector@example.com',
          password: 'aCompletelyOtherPassword',
        })
        .expect(401);

      const unknownUser = await request(http)
        .post(api('auth/login'))
        .send({ email: 'nobody@example.com', password: 'secretpassword123' })
        .expect(401);

      expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
      expect(unknownUser.body.message).toBe(wrongPassword.body.message);
    });

    it('revokes the whole session when a refresh token is used twice', async () => {
      const { cookies } = await registerUser();

      const rotated = await request(http)
        .post(api('auth/refresh'))
        .set('Cookie', cookies)
        .expect(200);

      // The original token is spent - a second use is suspicious.
      await request(http)
        .post(api('auth/refresh'))
        .set('Cookie', cookies)
        .expect(401);

      // And the token that came from it falls with it.
      await request(http)
        .post(api('auth/refresh'))
        .set('Cookie', rotated.headers['set-cookie'] as unknown as string[])
        .expect(401);
    });

    it('does not let anyone onto a protected endpoint without a token', async () => {
      await request(http)
        .get(api('games'))
        .expect(401)
        .expect((res) => expect(res.body.code).toBe('UNAUTHENTICATED'));
    });

    /**
     * Changing the email is half an account takeover, not an ordinary edit.
     *
     * The email is the login name, so moving it points the account at an
     * address of somebody else's choosing - and it used to cost nothing but a
     * valid access token, which lives for minutes. Changing the *password* has
     * always demanded the old one; this closes the cheaper door next to it.
     */
    describe('changing the profile', () => {
      const password = 'secretpassword123';

      it('renames without asking for a password', async () => {
        const { token } = await registerUser();

        await request(http)
          .patch(api('auth/me'))
          .set({ Authorization: `Bearer ${token}` })
          .send({ displayName: 'Renamed', email: 'collector@example.com' })
          .expect(200)
          .expect((res) => expect(res.body.displayName).toBe('Renamed'));
      });

      it('refuses to move the email without the current password', async () => {
        const { token } = await registerUser();

        await request(http)
          .patch(api('auth/me'))
          .set({ Authorization: `Bearer ${token}` })
          .send({ email: 'attacker@example.com' })
          .expect(400)
          .expect((res) => {
            expect(res.body.code).toBe('CURRENT_PASSWORD_REQUIRED');
            expect(res.body.fieldErrors.currentPassword).toBeDefined();
          });
      });

      it('refuses to move the email with a wrong password', async () => {
        const { token } = await registerUser();

        await request(http)
          .patch(api('auth/me'))
          .set({ Authorization: `Bearer ${token}` })
          .send({
            email: 'attacker@example.com',
            currentPassword: 'not-the-password',
          })
          .expect(400)
          .expect((res) =>
            expect(res.body.code).toBe('INVALID_CURRENT_PASSWORD'),
          );
      });

      it('moves the email once the password is proven, and signs in under it', async () => {
        const { token } = await registerUser();

        await request(http)
          .patch(api('auth/me'))
          .set({ Authorization: `Bearer ${token}` })
          .send({ email: 'moved@example.com', currentPassword: password })
          .expect(200)
          .expect((res) => expect(res.body.email).toBe('moved@example.com'));

        await request(http)
          .post(api('auth/login'))
          .send({ email: 'moved@example.com', password })
          .expect(200);
      });
    });

    /**
     * The absolute cap on a session's life.
     *
     * `REFRESH_TOKEN_TTL_DAYS` is an idle timeout - every rotation pushed it
     * forward, so a session used at least once a month never ended. The family
     * now carries a deadline that rotation copies but cannot move, and the new
     * token's expiry is the earlier of the two.
     *
     * Time is travelled by moving the deadline rather than the clock: the row is
     * the only state involved, so rewriting it is both honest and exact.
     */
    describe('the session cannot be renewed forever', () => {
      const onlyToken = () =>
        prisma.refreshToken.findFirstOrThrow({
          where: { usedAt: null, revokedAt: null },
          orderBy: { createdAt: 'desc' },
        });

      it('caps a renewed token at the family deadline instead of the full idle window', async () => {
        const { cookies } = await registerUser();

        // A session an hour away from its ceiling.
        const deadline = new Date(Date.now() + 60 * 60 * 1000);
        await prisma.refreshToken.updateMany({
          data: { familyExpiresAt: deadline },
        });

        await request(http)
          .post(api('auth/refresh'))
          .set('Cookie', cookies)
          .expect(200);

        const renewed = await onlyToken();
        // Not `now + REFRESH_TOKEN_TTL_DAYS` - the deadline is nearer.
        expect(renewed.expiresAt.getTime()).toBe(deadline.getTime());
        // And the deadline itself is carried over, not recomputed.
        expect(renewed.familyExpiresAt?.getTime()).toBe(deadline.getTime());
      });

      it('refuses to renew a session whose deadline has passed', async () => {
        const { cookies } = await registerUser();

        const past = new Date(Date.now() - 1000);
        await prisma.refreshToken.updateMany({
          data: { familyExpiresAt: past, expiresAt: past },
        });

        await request(http)
          .post(api('auth/refresh'))
          .set('Cookie', cookies)
          .expect(401)
          .expect((res) => expect(res.body.code).toBe('REFRESH_TOKEN_INVALID'));
      });

      /**
       * Tokens issued before the column existed have no deadline. They must not
       * be rejected - a deployment that signs everybody out is its own kind of
       * bug - so they are given a fresh window on their next rotation.
       */
      it('gives a token from before the migration a deadline instead of rejecting it', async () => {
        const { cookies } = await registerUser();

        await prisma.refreshToken.updateMany({
          data: { familyExpiresAt: null },
        });

        await request(http)
          .post(api('auth/refresh'))
          .set('Cookie', cookies)
          .expect(200);

        const renewed = await onlyToken();
        expect(renewed.familyExpiresAt).not.toBeNull();
        expect(renewed.familyExpiresAt!.getTime()).toBeGreaterThan(Date.now());
      });
    });

    /**
     * Regression: the stricter limit hung on a throttler named `auth`, but
     * `ThrottlerModule` only had `default` configured. The guard walks only the
     * configured throttlers, so nobody read the override and signing in stayed on
     * the global limit.
     *
     * The header with the evaluated limit is what is checked - unlike exhausting
     * the bucket, it does not depend on test order.
     */
    it('has a stricter limit on signing in than the rest of the API', async () => {
      const login = await request(http)
        .post(api('auth/login'))
        .send({ email: 'nobody@example.com', password: 'wrongpassword123' })
        .expect(401);

      const anywhereElse = await request(http).get(api('games')).expect(401);

      expect(Number(login.headers['x-ratelimit-limit'])).toBe(10);
      expect(Number(anywhereElse.headers['x-ratelimit-limit'])).toBeGreaterThan(
        10,
      );
    });
  });

  describe('collection', () => {
    it('walks through the whole lifecycle of a game', async () => {
      const { token } = await registerUser();
      const auth = { Authorization: `Bearer ${token}` };

      const created = await request(http)
        .post(api('games'))
        .set(auth)
        .send({
          title: 'Gran Turismo 4',
          platformId: await platformId('ps2'),
          releaseYear: 2004,
          developer: 'Polyphony Digital',
          purchasePrice: 349.5,
          condition: 'VERY_GOOD',
        })
        .expect(201);

      expect(created.body).toMatchObject({
        title: 'Gran Turismo 4',
        purchasePrice: 349.5,
        region: 'PAL',
        quantity: 1,
      });
      // Internal columns must not reach the response.
      expect(created.body.searchIndex).toBeUndefined();
      expect(created.body.userId).toBeUndefined();

      const id = created.body.id as string;

      await request(http)
        .patch(api(`games/${id}`))
        .set(auth)
        .send({ rating: 9, isFavorite: true })
        .expect(200)
        .expect((res) => {
          expect(res.body.rating).toBe(9);
          expect(res.body.isFavorite).toBe(true);
          // Fields that were not mentioned stay unchanged.
          expect(res.body.developer).toBe('Polyphony Digital');
        });

      await request(http)
        .delete(api(`games/${id}`))
        .set(auth)
        .expect(200);
      await request(http)
        .get(api(`games/${id}`))
        .set(auth)
        .expect(404);
    });

    /**
     * Regression: `updateGameSchema` was created as `createGameSchema.partial()`,
     * which however did not remove `.default()` from the enums or from
     * `genreIds`. A validated PATCH then contained values the user had never
     * sent, and the service wrote them. Toggling the favorite flag therefore
     * wiped a game's genres and reset its region, status, completeness and
     * currency.
     */
    it('PATCH changes only the submitted fields and leaves the rest alone', async () => {
      const { token } = await registerUser();
      const auth = { Authorization: `Bearer ${token}` };
      const genres = await prisma.genre.findMany({ take: 2 });

      const created = await request(http)
        .post(api('games'))
        .set(auth)
        .send({
          title: 'Silent Hill 2',
          platformId: await platformId('ps2'),
          genreIds: genres.map((genre) => genre.id),
          region: 'NTSC_J',
          condition: 'MINT',
          completeness: 'SEALED',
          status: 'COMPLETED',
          quantity: 3,
          purchasePrice: 20,
          purchaseCurrency: 'EUR',
        })
        .expect(201);

      const patched = await request(http)
        .patch(api(`games/${created.body.id}`))
        .set(auth)
        .send({ isFavorite: true })
        .expect(200);

      expect(patched.body).toMatchObject({
        isFavorite: true,
        region: 'NTSC_J',
        condition: 'MINT',
        completeness: 'SEALED',
        status: 'COMPLETED',
        quantity: 3,
        purchaseCurrency: 'EUR',
      });
      expect(patched.body.genres).toHaveLength(2);
    });

    /**
     * Uploaded covers used never to be deleted: neither replacing an image nor
     * deleting a game cleaned the file up, and the storage grew even when the
     * collection did not.
     */
    it('cleans up an uploaded cover after a replacement and after a deletion', async () => {
      const { token } = await registerUser();
      const auth = { Authorization: `Bearer ${token}` };

      const fakeUpload = (name: string): string => {
        writeFileSync(join(uploadsDir, name), 'not-a-real-image');
        return `/uploads/${name}`;
      };

      const first = fakeUpload('e2e-first.png');
      const second = fakeUpload('e2e-second.png');

      const created = await request(http)
        .post(api('games'))
        .set(auth)
        .send({
          title: 'Game with a cover',
          platformId: await platformId('ps2'),
          coverImageUrl: first,
        })
        .expect(201);

      // Replacing the cover releases the original one and leaves the new one be.
      await request(http)
        .patch(api(`games/${created.body.id}`))
        .set(auth)
        .send({ coverImageUrl: second })
        .expect(200);

      expect(existsSync(join(uploadsDir, 'e2e-first.png'))).toBe(false);
      expect(existsSync(join(uploadsDir, 'e2e-second.png'))).toBe(true);

      // Deleting the game releases the current one too.
      await request(http)
        .delete(api(`games/${created.body.id}`))
        .set(auth)
        .expect(200);

      expect(existsSync(join(uploadsDir, 'e2e-second.png'))).toBe(false);
    });

    it('keeps a cover that another game uses as well', async () => {
      const { token } = await registerUser();
      const auth = { Authorization: `Bearer ${token}` };
      const shared = 'e2e-shared.png';
      writeFileSync(join(uploadsDir, shared), 'not-a-real-image');

      const bodies = ['Game A', 'Game B'].map(async (title) =>
        request(http)
          .post(api('games'))
          .set(auth)
          .send({
            title,
            platformId: await platformId('ps2'),
            coverImageUrl: `/uploads/${shared}`,
          })
          .expect(201),
      );
      const [a] = await Promise.all(bodies);

      await request(http)
        .delete(api(`games/${a!.body.id}`))
        .set(auth)
        .expect(200);

      expect(existsSync(join(uploadsDir, shared))).toBe(true);
    });

    it('copes with duplicate genres instead of a nonsensical error', async () => {
      const { token } = await registerUser();
      const genre = await prisma.genre.findFirstOrThrow();

      const created = await request(http)
        .post(api('games'))
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'The same genre twice',
          platformId: await platformId('ps2'),
          genreIds: [genre.id, genre.id],
        })
        .expect(201);

      expect(created.body.genres).toHaveLength(1);
    });

    it('rejects a non-existent platform with an understandable field error', async () => {
      const { token } = await registerUser();

      const response = await request(http)
        .post(api('games'))
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Game', platformId: 'does-not-exist' })
        .expect(400);

      expect(response.body.code).toBe('PLATFORM_NOT_FOUND');
      expect(response.body.fieldErrors.platformId).toBeDefined();
    });

    it('does not let a user into a collection that is not theirs', async () => {
      const owner = await registerUser('owner@example.com');
      const intruder = await registerUser('intruder@example.com');

      const created = await request(http)
        .post(api('games'))
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'Private game', platformId: await platformId('ps2') })
        .expect(201);

      // The same response as for a non-existent ID - the API cannot be used to
      // find out that such a record exists at all.
      await request(http)
        .get(api(`games/${created.body.id}`))
        .set('Authorization', `Bearer ${intruder.token}`)
        .expect(404);

      await request(http)
        .delete(api(`games/${created.body.id}`))
        .set('Authorization', `Bearer ${intruder.token}`)
        .expect(404);

      await request(http)
        .get(api('games'))
        .set('Authorization', `Bearer ${intruder.token}`)
        .expect(200)
        .expect((res) => expect(res.body.meta.totalItems).toBe(0));
    });
  });

  describe('filters and sorting', () => {
    let auth: { Authorization: string };

    beforeEach(async () => {
      const { token } = await registerUser();
      auth = { Authorization: `Bearer ${token}` };

      const games = [
        {
          title: 'Pokémon Red',
          slug: 'ps4',
          releaseYear: 2015,
          condition: 'MINT',
          rating: 9,
        },
        {
          title: 'The Legend of Zelda',
          slug: 'n64',
          releaseYear: 1998,
          condition: 'GOOD',
          rating: 10,
        },
        {
          title: 'Super Mario World',
          slug: 'snes',
          releaseYear: 1990,
          condition: 'POOR',
          rating: null,
        },
      ];

      for (const game of games) {
        await request(http)
          .post(api('games'))
          .set(auth)
          .send({
            title: game.title,
            platformId: await platformId(game.slug),
            releaseYear: game.releaseYear,
            condition: game.condition,
            rating: game.rating,
          })
          .expect(201);
      }
    });

    const titles = async (query: string): Promise<string[]> => {
      const response = await request(http)
        .get(`${api('games')}${query}`)
        .set(auth)
        .expect(200);
      const body = response.body as { items: { title: string }[] };
      return body.items.map((game) => game.title);
    };

    it('finds a game even without diacritics', async () => {
      expect(await titles('?q=pokemon')).toEqual(['Pokémon Red']);
    });

    it('sorts by title without the leading article', async () => {
      // "The Legend of Zelda" belongs under L, so it comes before "Pokémon Red".
      expect(await titles('?sort=title&order=asc')).toEqual([
        'The Legend of Zelda',
        'Pokémon Red',
        'Super Mario World',
      ]);
    });

    it('sorts by condition starting with the best', async () => {
      expect(await titles('?sort=condition&order=desc')).toEqual([
        'Pokémon Red',
        'The Legend of Zelda',
        'Super Mario World',
      ]);
    });

    it('filters by a year range', async () => {
      expect(await titles('?yearFrom=1995&yearTo=2010')).toEqual([
        'The Legend of Zelda',
      ]);
    });

    it('finds the unrated copies', async () => {
      expect(await titles('?unrated=true')).toEqual(['Super Mario World']);
    });

    it('paginates and reports the right metadata', async () => {
      const response = await request(http)
        .get(`${api('games')}?pageSize=2&page=2`)
        .set(auth)
        .expect(200);

      expect(response.body.meta).toMatchObject({
        page: 2,
        pageSize: 2,
        totalItems: 3,
        totalPages: 2,
        hasPrevious: true,
        hasNext: false,
      });
      expect(response.body.items).toHaveLength(1);
    });

    it('does not crash on a nonsensical query string, it just rejects it', async () => {
      await request(http)
        .get(`${api('games')}?sort=nonexistent-column`)
        .set(auth)
        .expect(400)
        .expect((res) => expect(res.body.code).toBe('VALIDATION_FAILED'));
    });

    it('computes the collection overview including the filter values', async () => {
      const response = await request(http)
        .get(api('games/overview'))
        .set(auth)
        .expect(200);

      expect(response.body.stats).toMatchObject({
        totalGames: 3,
        totalCopies: 3,
        totalPlatforms: 3,
        averageRating: 9.5,
      });
      expect(response.body.facets.platforms).toHaveLength(3);
      expect(response.body.facets.conditions).toEqual([
        { value: 'MINT', label: 'Mint', count: 1 },
        { value: 'GOOD', label: 'Good', count: 1 },
        { value: 'POOR', label: 'Poor', count: 1 },
      ]);
    });
  });

  /**
   * The upload endpoint used to have no test at all - and it is the one place
   * where a stranger's bytes land on our disk under a name we then serve back
   * over HTTP. Declaring `Content-Type: image/png` costs an attacker nothing, so
   * what actually protects us is the signature check in `UploadsService`. That
   * is exactly what is exercised here, over real HTTP.
   */
  describe('cover uploads', () => {
    /** A real 1x1 PNG - the check reads the first 16 bytes, so they have to be genuine. */
    const PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8Dw' +
        'HwAFAAH/q842iQAAAABJRU5ErkJggg==',
      'base64',
    );

    const upload = (
      token: string,
      body: Buffer,
      filename: string,
      contentType: string,
    ) =>
      request(http)
        .post(api('uploads/cover'))
        .set({ Authorization: `Bearer ${token}` })
        .attach('file', body, { filename, contentType });

    /** File names are random, so a rejected upload is proven by "nothing new is left". */
    const storedFiles = () => readdirSync(uploadsDir).sort();

    it('accepts a real image and returns an address usable as a cover', async () => {
      const { token } = await registerUser();

      const response = await upload(
        token,
        PNG,
        'cover.png',
        'image/png',
      ).expect(201);

      expect(response.body).toMatchObject({
        mimeType: 'image/png',
        sizeBytes: PNG.length,
      });
      expect(response.body.url).toMatch(/^\/uploads\/[\w-]+\.png$/);
      expect(existsSync(join(uploadsDir, response.body.fileName))).toBe(true);

      // The address the endpoint hands out has to be accepted by the game
      // contract - otherwise the two halves of the feature would not fit.
      await request(http)
        .post(api('games'))
        .set({ Authorization: `Bearer ${token}` })
        .send({
          title: 'Uploaded cover',
          platformId: await platformId(),
          coverImageUrl: response.body.url,
        })
        .expect(201);
    });

    /**
     * The heart of it: an HTML file under an `image/png` header. Without the
     * signature check this would be stored XSS on our own domain - the file is
     * served from `/uploads` on the same origin as the application.
     */
    it('rejects a file whose contents are not an image, and does not keep it', async () => {
      const { token } = await registerUser();
      const before = storedFiles();

      const response = await upload(
        token,
        Buffer.from('<html><script>alert(1)</script></html>'),
        'cover.png',
        'image/png',
      ).expect(400);

      expect(response.body.code).toBe('UPLOAD_REJECTED');
      expect(storedFiles()).toEqual(before);
    });

    /**
     * WebP is two checks in one (`RIFF` at the start *and* `WEBP` at offset 8),
     * so a RIFF container that is not WebP is the case a sloppier check would
     * wave through.
     */
    it('is not fooled by a RIFF container that is not a WebP', async () => {
      const { token } = await registerUser();
      const before = storedFiles();

      const riffAvi = Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.alloc(4),
        Buffer.from('AVI '),
        Buffer.alloc(16),
      ]);

      await upload(token, riffAvi, 'cover.webp', 'image/webp').expect(400);
      expect(storedFiles()).toEqual(before);
    });

    /** A real image, but under a lie about its type - the two have to agree. */
    it('refuses an image whose real format differs from the declared one', async () => {
      const { token } = await registerUser();
      const before = storedFiles();

      await upload(token, PNG, 'cover.jpg', 'image/jpeg').expect(400);
      expect(storedFiles()).toEqual(before);
    });

    it('turns down a format that is not an image at all before writing it', async () => {
      const { token } = await registerUser();
      const before = storedFiles();

      const response = await upload(
        token,
        Buffer.from('%PDF-1.7'),
        'cover.pdf',
        'application/pdf',
      ).expect(400);

      expect(response.body.code).toBe('UPLOAD_REJECTED');
      expect(storedFiles()).toEqual(before);
    });

    it('says what is missing when no file is sent', async () => {
      const { token } = await registerUser();

      const response = await request(http)
        .post(api('uploads/cover'))
        .set({ Authorization: `Bearer ${token}` })
        .expect(400);

      expect(response.body.code).toBe('UPLOAD_REJECTED');
    });

    it('does not let an anonymous request upload anything', async () => {
      const before = storedFiles();

      await request(http)
        .post(api('uploads/cover'))
        .attach('file', PNG, {
          filename: 'cover.png',
          contentType: 'image/png',
        })
        .expect(401);

      expect(storedFiles()).toEqual(before);
    });

    /**
     * `coverImageUrl` is user input, and deleting a game hands it to `unlink`.
     * The contract cannot catch this one - `/uploads/../…` does start with
     * `/uploads/`, so it passes validation; what has to hold is `localFileName`,
     * which refuses any name containing a separator.
     *
     * The target is deliberately the e2e database sitting one directory above the
     * uploads folder: if the guard ever gave way, this test would not merely fail,
     * it would take the whole run's database with it.
     */
    it('cannot delete a file outside the uploads directory through a cover path', async () => {
      const { token } = await registerUser();
      const auth = { Authorization: `Bearer ${token}` };
      const outsideFile = join(uploadsDir, '..', 'e2e.db');

      expect(existsSync(outsideFile)).toBe(true);

      const created = await request(http)
        .post(api('games'))
        .set(auth)
        .send({
          title: 'Traversal',
          platformId: await platformId(),
          coverImageUrl: '/uploads/../e2e.db',
        })
        .expect(201);

      // Deleting the game is what triggers the cover release.
      await request(http)
        .delete(api(`games/${created.body.id}`))
        .set(auth)
        .expect(200);

      expect(existsSync(outsideFile)).toBe(true);
    });
  });
});
