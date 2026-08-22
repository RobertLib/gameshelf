import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { API_PREFIX } from '@gameshelf/contracts';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AppConfig } from './config/env';
import { UPLOADS_PUBLIC_PATH } from './uploads/uploads.service';

/**
 * Application setup outside the DI container: prefix, middleware, static files.
 *
 * It lives separately so the e2e tests can use it too. While the tests wired up
 * `setGlobalPrefix` and `cookieParser` themselves, they tested a configuration
 * that could silently drift from the production one - middleware added in
 * `main.ts` never reached the tests.
 */
export function configureApp(
  app: NestExpressApplication,
  config: AppConfig,
  logger = new Logger('Bootstrap'),
): void {
  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''));

  configureTrustProxy(app, config, logger);

  // The refresh token travels in a cookie, not in a header.
  app.use(cookieParser());

  app.use(
    helmet({
      /**
       * A CSP only makes sense where we serve the frontend as well. Cover images
       * may be external links, which is why `img-src` allows https and data URIs.
       */
      contentSecurityPolicy: config.web.serve
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
              fontSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              baseUri: ["'self'"],
            },
          }
        : false,
      // Covers are loaded from <img> on the same origin; COEP would only
      // complicate that.
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  serveUploads(app, config);
  if (config.web.serve) serveWebApp(app, config, logger);
}

/*
 * There is deliberately no CORS setup here.
 *
 * The application is single-origin by design: in production one process serves
 * both the API and the built frontend (`SERVE_WEB`), and in development the
 * Vite dev server proxies `/api` and `/uploads` to it (see
 * `apps/web/vite.config.ts`), so the browser talks to one origin there too -
 * which is the only way the httpOnly refresh cookie behaves the same in both.
 *
 * A `CORS_ORIGINS` variable used to live here and could never actually be used:
 * the API client sends `credentials: 'same-origin'` and builds relative URLs,
 * so no cross-origin request it makes would carry the cookie in the first
 * place. Configuration that cannot work is worse than none - it reads like a
 * supported deployment. Serving the frontend from somewhere else would need
 * `enableCors` here, `credentials: 'include'` in the client and an absolute API
 * base URL in the build; until all three exist, this is not that deployment.
 */

/**
 * Who to trust the `X-Forwarded-For` header from.
 *
 * The request limits rest on this: `ThrottlerGuard` counts by `req.ip`, and
 * without `trust proxy` that is always the same value behind a reverse proxy. A
 * limit of "10 sign-ins per minute per IP" would then apply to all visitors
 * together and a single bot would lock the whole instance out of signing in.
 *
 * It is set explicitly through `TRUST_PROXY`, because the opposite mistake is
 * just as ugly: an application exposed directly that trusts `X-Forwarded-For`
 * would let anyone bypass the limit with a made-up header.
 */
function configureTrustProxy(
  app: NestExpressApplication,
  config: AppConfig,
  logger: Logger,
): void {
  app.set('trust proxy', config.trustProxy);

  /**
   * `COOKIE_SECURE` means "we are running over HTTPS", and that is typically
   * handled by a proxy. If we do not trust that proxy at the same time, the
   * per-IP limits are only apparent - exactly the kind of bug nobody notices
   * until somebody abuses it.
   */
  if (config.trustProxy === false && config.auth.cookieSecure) {
    logger.warn(
      'COOKIE_SECURE is enabled but TRUST_PROXY is not. Behind a reverse ' +
        'proxy the request limits then count every visitor as a single IP - ' +
        'set TRUST_PROXY (usually 1).',
    );
  }
}

/** Uploaded covers. A long cache is safe - the file names are random. */
function serveUploads(app: NestExpressApplication, config: AppConfig): void {
  app.use(
    UPLOADS_PUBLIC_PATH,
    express.static(config.uploadsDir, {
      index: false,
      maxAge: '30d',
      immutable: true,
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }),
  );
}

/**
 * In production a single process serves both the API and the built React app.
 *
 * Hashed files from `assets/` are cached forever, `index.html` never - otherwise
 * the browser would keep showing the old version after a deployment. Anything
 * that is neither the API, an upload nor an existing file gets `index.html`, so
 * that reloading a client-side route works.
 */
function serveWebApp(
  app: NestExpressApplication,
  config: AppConfig,
  logger: Logger,
): void {
  const indexPath = join(config.web.distPath, 'index.html');

  if (!existsSync(indexPath)) {
    logger.warn(
      `SERVE_WEB is enabled but ${indexPath} does not exist. Run "npm run build" first.`,
    );
    return;
  }

  /**
   * Source maps do not belong outside - and `sourcemap: 'hidden'` is not enough.
   *
   * With that setting Vite still generates the map, it only strips the reference
   * to it from the bundle. The file therefore sits in `dist` next to a bundle
   * whose name is visible in `index.html`, so the map's address is one appended
   * `.map` away - and with it the whole frontend source code. The filter has to
   * come before `express.static`, otherwise the static handler answers first.
   */
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (req.path.endsWith('.map')) {
        res.sendStatus(404);
        return;
      }
      next();
    },
  );

  app.use(
    express.static(config.web.distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        res.setHeader(
          'Cache-Control',
          /assets[\\/]/.test(filePath)
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=0, must-revalidate',
        );
      },
    }),
  );

  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (
        isUnder(req.path, API_PREFIX) ||
        isUnder(req.path, UPLOADS_PUBLIC_PATH)
      ) {
        return next();
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexPath);
    },
  );
}

/**
 * Does the path lie under the given prefix? A plain `startsWith` is not enough -
 * `/apifoo` starts with `/api` but does not belong to the API and should get the
 * SPA.
 */
function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}
