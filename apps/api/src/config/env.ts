import { z } from 'zod';
import { resolve } from 'node:path';

/**
 * Environment validation at startup.
 *
 * The application would rather not start at all than run with a missing secret
 * for signing tokens. The result is typed, so `process.env` is not touched
 * anywhere else in the code.
 */

const booleanish = z.union([z.boolean(), z.string()]).transform((v) => {
  if (typeof v === 'boolean') return v;
  return ['true', '1', 'yes', 'on'].includes(v.trim().toLowerCase());
});

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL must be set.'),

    JWT_ACCESS_SECRET: z.string().default(''),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(60 * 60 * 24)
      .default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    /**
     * How long a session may be renewed for at the very most.
     *
     * `REFRESH_TOKEN_TTL_DAYS` is an *idle* timeout - every rotation pushes it
     * forward, so without this cap a session used at least once a month would
     * never end. This is the ceiling that cannot be pushed.
     */
    REFRESH_TOKEN_ABSOLUTE_TTL_DAYS: z.coerce
      .number()
      .int()
      .min(1)
      .max(3650)
      .default(90),
    COOKIE_SECURE: booleanish.default(false),

    UPLOADS_DIR: z.string().default('var/uploads'),

    /** Fill the platform and genre lookup tables when the application starts. */
    SEED_CATALOG_ON_START: booleanish.default(true),

    /**
     * How many reverse proxies stand in front of the application (or which
     * addresses belong to them). Without it `req.ip` is the proxy address, so
     * every visitor shares a single bucket for the "per IP" limits. See
     * `parseTrustProxy`.
     */
    TRUST_PROXY: z.string().default(''),

    SERVE_WEB: booleanish.default(false),
    WEB_DIST_PATH: z.string().default('../web/dist'),

    /**
     * Unless set explicitly, Swagger is enabled in development and disabled in
     * production. Publicly exposed documentation of an internal API is a free
     * hint for anyone probing the application.
     */
    ENABLE_SWAGGER: booleanish.optional(),
    THROTTLE_LIMIT: z.coerce.number().int().min(1).default(300),
    THROTTLE_TTL_SECONDS: z.coerce.number().int().min(1).default(60),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.JWT_ACCESS_SECRET.length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_ACCESS_SECRET'],
        message:
          'In production JWT_ACCESS_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 48',
      });
    }

    /**
     * A ceiling below the idle timeout is not a stricter setting, it is a
     * contradiction: every token would be born already capped, so the effective
     * session length would be the absolute value and `REFRESH_TOKEN_TTL_DAYS`
     * would quietly stop meaning anything.
     */
    if (env.REFRESH_TOKEN_ABSOLUTE_TTL_DAYS < env.REFRESH_TOKEN_TTL_DAYS) {
      ctx.addIssue({
        code: 'custom',
        path: ['REFRESH_TOKEN_ABSOLUTE_TTL_DAYS'],
        message:
          `REFRESH_TOKEN_ABSOLUTE_TTL_DAYS (${env.REFRESH_TOKEN_ABSOLUTE_TTL_DAYS}) must not be ` +
          `lower than REFRESH_TOKEN_TTL_DAYS (${env.REFRESH_TOKEN_TTL_DAYS}) - the absolute cap is ` +
          'the ceiling for renewing a session, not a replacement for the idle timeout.',
      });
    }
  });

export type RawEnv = z.infer<typeof envSchema>;

/** The configuration as the rest of the application sees it - paths already absolute. */
export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  auth: {
    accessSecret: string;
    accessTtlSeconds: number;
    /** Idle timeout: how long an unused refresh token stays valid. */
    refreshTtlDays: number;
    /** Ceiling: how long a session may be renewed for, however actively it is used. */
    refreshAbsoluteTtlDays: number;
    cookieSecure: boolean;
  };
  uploadsDir: string;
  seedCatalogOnStart: boolean;
  /** Value for Express `trust proxy`; `false` = the application is exposed directly. */
  trustProxy: boolean | number | string;
  web: {
    serve: boolean;
    distPath: string;
  };
  enableSwagger: boolean;
  throttle: { limit: number; ttlSeconds: number };
}

/**
 * In development we supply a secret ourselves so that `npm run dev` works right
 * after cloning. In production the `superRefine` above forbids that.
 */
function resolveAccessSecret(env: RawEnv): string {
  if (env.JWT_ACCESS_SECRET.length > 0) return env.JWT_ACCESS_SECRET;
  return 'gameshelf-dev-only-secret-do-not-use-in-production';
}

/**
 * Converts `TRUST_PROXY` into a value Express understands.
 *
 * Without `trust proxy` Express takes `req.ip` from the TCP connection, so
 * behind a reverse proxy it is always one and the same address - a limit of
 * "10 sign-ins per minute per IP" then applies to the whole world together and a
 * single bot locks everyone out of signing in. It must not be turned on blindly
 * either: if the application trusted `X-Forwarded-For` even where it is exposed
 * directly, anyone could bypass the limit with a made-up header. That is why it
 * is explicit configuration rather than a default.
 *
 *   (empty) / false  -> trust nobody (the default, direct exposure)
 *   1, 2, …          -> number of proxies between the client and the application
 *   loopback         -> an Express keyword
 *   10.0.0.0/8, …    -> specific proxy addresses or ranges
 *   true             -> trust the entire chain (only when nothing else works)
 */
export function parseTrustProxy(raw: string): boolean | number | string {
  const value = raw.trim();
  const lower = value.toLowerCase();

  if (lower === '' || ['false', '0', 'no', 'off'].includes(lower)) return false;
  if (['true', 'yes', 'on'].includes(lower)) return true;

  const hops = Number(value);
  if (Number.isInteger(hops) && hops > 0) return hops;

  return value;
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map(
        (issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`,
      )
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  const env = parsed.data;

  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    auth: {
      accessSecret: resolveAccessSecret(env),
      accessTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
      refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      refreshAbsoluteTtlDays: env.REFRESH_TOKEN_ABSOLUTE_TTL_DAYS,
      cookieSecure: env.COOKIE_SECURE,
    },
    uploadsDir: resolve(process.cwd(), env.UPLOADS_DIR),
    seedCatalogOnStart: env.SEED_CATALOG_ON_START,
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    web: {
      serve: env.SERVE_WEB,
      distPath: resolve(process.cwd(), env.WEB_DIST_PATH),
    },
    enableSwagger: env.ENABLE_SWAGGER ?? env.NODE_ENV !== 'production',
    throttle: {
      limit: env.THROTTLE_LIMIT,
      ttlSeconds: env.THROTTLE_TTL_SECONDS,
    },
  };
}

/** Token used to inject the configuration through DI. */
export const APP_CONFIG = 'APP_CONFIG';
