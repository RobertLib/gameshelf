# GameShelf

A catalog of a physical collection of computer and console games. Every
collector gets their own shelf: they add games together with the details that
matter for physical copies (region, completeness of the packaging, condition,
location in storage) and then search through them with combinable filters.

A NestJS REST API and a React frontend live in one repository, share a single
contracts package, and in production are served by one process on one port.

---

## Quick start

```bash
git clone <repository> gameshelf && cd gameshelf
cp apps/api/.env.example apps/api/.env
npm run setup     # install, build the contracts, migrate, seed the lookup tables
npm run dev       # API on :3000, frontend on :5173
```

Open <http://localhost:5173>, sign up and add your first game.
The API documentation runs at <http://localhost:3000/api/docs>.

Requires Node.js 20.12+ (`process.loadEnvFile`); developed and tested on 22,
which is what `.nvmrc` and the Docker image use. The database is SQLite by default,
so nothing else needs to be installed.

---

## Layout

```
gameshelf/
├── packages/
│   └── contracts/        Zod schemas + derived types + the endpoint inventory
├── apps/
│   ├── api/              NestJS 11, Prisma, SQLite/PostgreSQL
│   └── web/              React 19, Vite, TanStack Query, Tailwind 4
├── Dockerfile            the whole application as a single image
└── docker-entrypoint.sh  migrations when the container starts
```

It is an npm workspace. `@gameshelf/contracts` is a dependency of both
applications and has to be built before them - the root scripts take care of the
order.

---

## The type link between the API and the frontend

The requirement was for React and NestJS to be linked through types. The
solution rests on the `packages/contracts` package, which is the single source
of truth about the interface. It contains no code that depends on Node.js or on
the browser, so both sides can import it.

An endpoint is described once:

```ts
// packages/contracts/src/api.ts
export const contract = {
  games: {
    update: defineEndpoint({
      method: 'PATCH',
      path: 'games/:id',
      body: updateGameSchema,
      response: gameSchema,
      auth: true,
      summary: 'Update a game',
      tag: 'games',
    }),
  },
};
```

**The backend** takes the path, the method, the success status and the
validation schema from that definition - it copies none of them:

```ts
@Endpoint(contract.games.update)                    // route + status + protection
update(
  @CurrentUser() user: AuthenticatedUser,
  @Param('id') id: string,
  @ContractBody(contract.games.update) body: UpdateGameInput,  // input validation
): Promise<Output<typeof contract.games.update>> {   // enforced response shape
  return this.games.update(user.id, id, body);
}
```

**The frontend** calls the very same object and derives its types:

```ts
apiRequest(contract.games.update, { params: { id }, body: { rating: 9 } });
//         ↑ the endpoint yields the method, the URL, the body shape and the result type
```

What that means in practice:

| Change in the contract                  | What happens                                             |
| --------------------------------------- | -------------------------------------------------------- |
| renaming a response field               | the API mapper **and** the UI components fail to compile |
| changing `games/:id` to `games/:gameId` | every client call fails to compile                       |
| adding a required field to the body     | the form fails to compile                                |

Two runtime safety nets guard it as well: `ContractResponseInterceptor` on the
server validates every response against the schema (in development a mismatch is
an error, in production it is logged) and at the same time strips fields that do
not belong in the response; the API client in the browser parses incoming data
with the same schema, so an incompatible API version ends in an understandable
message instead of `undefined is not an object` inside a component.

The same schemas also generate the OpenAPI documentation (`/api/docs`) and
validate the forms in the browser - the rule "a password of at least 10
characters" exists exactly once in the whole project.

---

## Data model

A `Game` is one physical copy (or a group of identical copies) in one user's
collection. Besides the title, the release year, the developer, the publisher
and the cover it carries what a collector really cares about:

- **region** (PAL / NTSC-U / NTSC-J / region free)
- **completeness** - factory sealed, CIB, boxed without a manual, loose media…
- **condition** - from "mint" to "poor"
- **play status**, a 1-10 rating, a favorite flag
- **purchase** - price, currency, date, where it was bought, estimated value today
- **location** - where the game physically lives
- **number of copies**, edition, barcode, notes

Platforms and genres are separate lookup tables (`Platform`, `Genre`), not free
text - otherwise "PS2" would end up next to "PlayStation 2" in the filters. The
application seeds them itself at startup, so a fresh deployment is usable right
away.

A few decisions worth explaining:

- **Money is stored in cents** (`purchasePriceMinor: Int`). Decimal numbers
  would start returning totals like `12345.670000000002` after a few hundred
  items.
- **`sortTitle` and `searchIndex` are derived columns.** The first sorts
  "The Legend of Zelda" under L, the second is a normalized concatenation of
  every searchable field, thanks to which an accent-free search term matches an
  accented title.
- **`conditionRank`** is a numeric weight of the condition; without it, "by
  condition" would sort alphabetically by the name of the constant.
- **The purchase date is the text `YYYY-MM-DD`.** It sorts correctly and is
  immune to the time zone shifts that only cause harm for a plain date.

---

## Filtering the collection

The list accepts more than fifteen combinable filters: full text, platforms,
genres (in "at least one" / "all" mode), region, condition, completeness, play
status, ranges of release year, rating and price, developer, publisher, location
and toggles for favorites / without a cover / not rated. Sorting works over
eight fields in both directions, with pagination.

Two things make it a usable tool:

**The filters live in the URL.** The state is held in the query string rather
than in a component, so the back button works, a link to a particular selection
can be shared and a page reload loses nothing. It is parsed by the same Zod
schema the backend uses - a hand-edited address therefore ends either in a valid
filter or in the default state, never in a crash.

**The filter choices are built from the contents of the collection.** The
`games/overview` endpoint returns a count for every option, and somebody who
collects only PlayStation does not get twenty consoles they do not own in the
panel. The same response also powers the dashboard, so the overview adds no
further database queries.

An invalid value in the address discards **only itself**, not the whole filter:
out of `?q=zelda&yearFrom=1` the search term stays and only the nonsensical year
is dropped. A reversed range (`?yearFrom=2000&yearTo=1990`) is rejected rather
than answered with an empty list - otherwise a mistyped year would be
indistinguishable from a genuinely empty selection. The panel cannot produce one:
an edit that would cross the other end of a range pushes it along instead.

Full-text search is `LIKE '%term%'` over the derived `searchIndex` column.
Because of the leading wildcard no index can be used, so it is a scan of the
whole collection - for a personal shelf (thousands of records) that is
irrelevant, for orders of magnitude more data FTS5 or `tsvector` would be needed.

---

## Signing in

Classic email + password, but built to hold up:

- passwords are hashed with **argon2id** using the OWASP recommended parameters,
- the **access token** (a JWT, 15 minutes) is kept by the frontend in the tab's
  memory only - not in `localStorage`, from where a single line of foreign script
  can lift it,
- the **refresh token** travels exclusively in an `httpOnly` cookie that
  JavaScript cannot see at all, and **is rotated on every use**,
- if an already spent refresh token shows up, it means it leaked - the whole
  session is revoked,
- a session has a **longest possible life**: `REFRESH_TOKEN_TTL_DAYS` (30) is an
  idle timeout that every rotation pushes forward, so on its own it would let an
  actively used session live forever. Each session therefore carries a deadline
  that rotation copies but cannot move, and after
  `REFRESH_TOKEN_ABSOLUTE_TTL_DAYS` (90) signing in again is required,
- the API client refreshes an expired token silently in the background and
  repeats the request, so the user never notices the token's short lifetime,
- signing in to a non-existent account takes exactly as long as signing in with
  a wrong password, so the response time cannot reveal which emails are
  registered,
- signing in and registration have their own limit of 10 attempts per minute per
  IP (300 for the rest of the API); an e2e test guards it, because such a limit
  can stop working without anybody noticing.

Behind a reverse proxy this additionally needs `TRUST_PROXY`. Without it Express
takes `req.ip` from the TCP connection, so behind a proxy it would always be the
same - a "per IP" limit would then apply to all visitors together and a single
bot would lock the whole instance out of signing in. It cannot be turned on
blindly either: an application exposed directly that trusts `X-Forwarded-For`
would let anyone bypass the limit with a made-up header. When `COOKIE_SECURE` is
enabled and `TRUST_PROXY` is not, the application warns about it at startup.

Refresh tokens are cleaned up periodically (every 6 hours), not only at startup -
otherwise a container running for months would last have cleaned up at
deployment time.

In this version every user sees only their own games. Every query is bound to a
`userId`; somebody else's ID returns the same 404 as a non-existent one, so the
API cannot even be used to find out that such a record exists for another user.

---

## Uploading covers

A cover can be an uploaded file or a link elsewhere - both end up in the same
field. Uploaded files are stored on disk under a random name (the name from the
client is discarded, otherwise somebody else's file could be overwritten) and
**their actual contents are checked**, not just the `Content-Type` header.
Without that, HTML could be uploaded under an `image/png` header, giving us
stored XSS on our own domain.

The files are also **cleaned up**: both replacing a cover and deleting a game
release the previous one, provided no other record points at it. On top of that a
sweep runs at startup and then every 6 hours, throwing away files that no game
claims and that are older than a day (that margin exists for a form in progress,
where the image is uploaded but the game not yet saved). The sweep is what
catches an abandoned form - the image is sent the moment it is picked, so without
it every unfinished addition would leave a file behind until the next restart.

The address of an uploaded file is **public, merely unguessable** (a random
UUID). That is a conscious trade-off: `<img>` cannot send an `Authorization`
header, so real authorization of images would mean signed addresses or another
cookie. For a catalog of one's own collection that is not worth the complexity -
whoever does not know the address will not find the file.

---

## Deployment

The application is a monolith on purpose: in production one process serves both
the API and the built React app, so there is nothing to coordinate between two
services and both CORS and cross-domain cookie sharing disappear.

### Docker

```bash
docker build -t gameshelf .
docker run -p 3000:3000 \
  -v gameshelf-data:/app/var \
  -e JWT_ACCESS_SECRET="$(openssl rand -base64 48)" \
  gameshelf
```

The `/app/var` volume holds both the database and the uploaded images.
Migrations run when the container starts, and the application seeds the lookup
tables itself.

### Without Docker

```bash
npm ci
npm run build            # contracts -> frontend -> API
npm run db:deploy        # migrations
NODE_ENV=production \
JWT_ACCESS_SECRET="…" \
SERVE_WEB=true \
COOKIE_SECURE=true \
npm start
```

`GET /api/health` reports the state of both the application and the database -
usable as a hosting health check.

### Moving to PostgreSQL

The schema is written portably (no native enums or arrays), so it is enough to:

1. change `provider = "postgresql"` in `apps/api/prisma/schema.prisma`,
2. point `DATABASE_URL` at the connection string,
3. run `npm run db:migrate -- --name init-postgres`.

---

## Configuration

Everything is read from `apps/api/.env`; the descriptions and default values are
in `apps/api/.env.example`. The configuration is validated by a Zod schema at
startup: if `JWT_ACCESS_SECRET` is missing in production, the application would
rather not start than run with a default secret.

| Variable                          | Default                    | Purpose                                                            |
| --------------------------------- | -------------------------- | ------------------------------------------------------------------ |
| `PORT`                            | `3000`                     | API port                                                           |
| `DATABASE_URL`                    | `file:../var/gameshelf.db` | database connection                                                |
| `JWT_ACCESS_SECRET`               | —                          | signing of access tokens (required in production)                  |
| `ACCESS_TOKEN_TTL_SECONDS`        | `900`                      | access token lifetime                                              |
| `REFRESH_TOKEN_TTL_DAYS`          | `30`                       | refresh token idle timeout (pushed forward by every use)           |
| `REFRESH_TOKEN_ABSOLUTE_TTL_DAYS` | `90`                       | ceiling on a session's life; renewing cannot push it               |
| `COOKIE_SECURE`                   | `false`                    | turn on when running over HTTPS                                    |
| `UPLOADS_DIR`                     | `var/uploads`              | image storage                                                      |
| `SERVE_WEB`                       | `false`                    | let the API serve the built frontend too                           |
| `SEED_CATALOG_ON_START`           | `true`                     | seed the lookup tables at startup                                  |
| `WEB_DIST_PATH`                   | `../web/dist`              | where the built frontend is served from                            |
| `TRUST_PROXY`                     | —                          | how many reverse proxies stand in front (needed for per-IP limits) |
| `ENABLE_SWAGGER`                  | per `NODE_ENV`             | documentation at `/api/docs`; on in development, off in production |
| `THROTTLE_LIMIT`                  | `300`                      | requests per window (sign-in and uploads have their own)           |
| `THROTTLE_TTL_SECONDS`            | `60`                       | length of the request-limit window                                 |

There is deliberately no CORS variable: the application is single-origin. In
development the Vite dev server proxies `/api` and `/uploads` to the API, so the
browser sees one origin there too and the httpOnly refresh cookie behaves
exactly as it does in production. Serving the frontend from a different origin
is not a supported deployment - it would need `enableCors` on the server,
`credentials: 'include'` in the API client and an absolute API base URL in the
build.

Besides `.env`, `.env.local` is loaded too if it exists - it serves for the
deviations of a single machine and takes precedence over `.env`. Real
environment variables override both files. The Prisma CLI uses the same order
(both `apps/api/prisma.config.ts` and the application call the same
`loadEnvFiles`), so migrations never touch a different database from the one the
API then runs against.

---

## Scripts

| Command              | What it does                                                  |
| -------------------- | ------------------------------------------------------------- |
| `npm run setup`      | install + build the contracts + migrate + seed                |
| `npm run dev`        | contracts in watch mode, API and frontend together            |
| `npm run build`      | builds the contracts, the frontend and the API, in that order |
| `npm start`          | production start (a single process)                           |
| `npm run typecheck`  | type check across every package                               |
| `npm run lint`       | ESLint (type-aware rules, hooks)                              |
| `npm run format`     | Prettier over the whole repo                                  |
| `npm test`           | unit tests of the API and the frontend                        |
| `npm run test:e2e`   | end-to-end tests of the API                                   |
| `npm run db:migrate` | a new migration in development                                |
| `npm run db:studio`  | Prisma Studio over the database                               |
| `npm run db:reset`   | drops the database and creates it again                       |

`.github/workflows/ci.yml` guards the same things in the same order - including
that the Docker image builds.

Tests:

- **API, unit** (`npm test --workspace @gameshelf/api`) - translation of filters
  into queries, the derived columns, working with money, the health check and the
  completeness of the column map (a new contract field must not silently fall out
  of the write path).
- **API, end-to-end** (`npm run test:e2e`) - over HTTP against a temporary
  database: authentication, token rotation, isolation between users, filters, a
  partial PATCH, request limits and the cleanup of uploaded covers.
- **Frontend** (`npm test --workspace @gameshelf/web`) - the pure logic that can
  break silently: translating filters from the URL and back, the active filter
  chips, the form resolver, the pagination window and the formatting helpers.

The API type check runs against `tsconfig.check.json`, which also includes the
tests, the seed and `prisma.config.ts` - `tsconfig.json` is limited to `src`, so
those files used to be type-checked by nobody. The build still uses
`tsconfig.build.json`.

The e2e tests assemble the application through `configureApp()` from
`src/bootstrap.ts` - the very function `main.ts` uses. Middleware added there is
therefore automatically reflected in the tests too, and the production
configuration cannot drift from the tested one.

---

## Conscious trade-offs

Things that are this way on purpose, but worth knowing about:

- **Uploaded covers are served without authentication.** They are protected only
  by the random UUID in the name - whoever knows the address can download the
  image. For a private collection that is enough, for anything more sensitive it
  is not.
- **An access token cannot be revoked.** Changing the password invalidates the
  refresh tokens immediately, but an already issued JWT stays valid until it
  expires (15 minutes by default). A shorter `ACCESS_TOKEN_TTL_SECONDS` narrows
  that window.
- **The application is single-instance, and in more places than the database.**
  SQLite and the images on the local disk are the obvious ones; on top of that
  the request-limit counters live in the process memory (with N replicas the
  limit is N times looser), `CatalogService` keeps the lookup tables in a
  five-minute in-process cache (replicas would disagree for up to five minutes
  after a change) and both background jobs - the refresh-token purge and the
  orphaned-cover sweep - run on a `setInterval` inside every instance. Scaling
  out therefore means more than swapping in PostgreSQL: shared counter storage
  (Redis), cache invalidation through the database or a message, and moving the
  two jobs out into a single scheduled task.
- **Registration says whether an address is already taken.** Signing in gives
  nothing away (a non-existent account is verified against a dummy hash so it
  does not answer faster), but the sign-up form answers `EMAIL_TAKEN` honestly.
  Hiding it would mean "we have sent you a link" - that is, an email channel the
  application does not have. Until then the endpoint relies on its own tightened
  rate limit.
- **The domain labels live in `packages/contracts`.** `REGION_LABELS`,
  `CONDITION_LABELS` and the rest are read by the frontend _and_ by the server
  (`CollectionOverviewService` labels the filter facets with them), so a second
  language is not a matter of translating the UI - it needs the language on the
  wire, either as a parameter of `games/overview` or by moving the labels out and
  having the API return bare values.
- **A cover link can be shared by several games, even across users.** A file is
  only deleted once no record points at it. Whoever manually pastes somebody
  else's `/uploads/…` into `coverImageUrl` keeps that foreign file on disk.
- **The collection value totals are not multiplied by the number of copies.**
  `purchasePrice` is the price of the record, not of a single copy; `quantity` is
  summed separately as "physical copies".
- **Frontend source maps are generated but never get out.**
  `sourcemap: 'hidden'` only removes the reference from the bundle - the file
  itself stays in `dist` and its address can be derived from the bundle name in
  `index.html`. The API therefore refuses to serve them and the Docker image does
  not contain them at all; for tracking an error down from a stack trace they stay
  where the build happened.

---

## What this version deliberately does not have

- sharing a collection between users and public profiles,
- a wish list and lending copies out,
- import from external game databases (IGDB, MobyGames) and barcode scanning,
- CSV export and bulk edits,
- forgotten password recovery by email,
- server-side resizing of uploaded images.

The model and the contracts are ready for most of that - adding a new field
means editing the schema in `packages/contracts`, a migration and extending the
form.
