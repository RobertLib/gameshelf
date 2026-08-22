import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { API_PREFIX } from '@gameshelf/contracts';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { APP_CONFIG, type AppConfig } from './config/env';
import { buildOpenApiDocument } from './openapi/build-document';

/** API version for the OpenAPI document. */
const API_VERSION = '0.1.0';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const config = app.get<AppConfig>(APP_CONFIG);
  const logger = new Logger('Bootstrap');

  configureApp(app, config, logger);

  /**
   * Without this, `onModuleDestroy` never runs.
   *
   * Inside a container Node is PID 1 and would die on the spot on SIGTERM:
   * without `$disconnect()`, without finishing the in-flight requests and, on
   * SQLite, without a WAL checkpoint. Nest only starts catching signals itself
   * after this call - token cleanup, Prisma and the rest then shut down cleanly.
   */
  app.enableShutdownHooks();

  if (config.enableSwagger) setupSwagger(app);

  await app.listen(config.port, '0.0.0.0');

  logger.log(`API is running at http://localhost:${config.port}${API_PREFIX}`);
  if (config.enableSwagger) {
    logger.log(
      `Documentation: http://localhost:${config.port}${API_PREFIX}/docs`,
    );
  }
  if (config.web.serve) {
    logger.log(`Frontend served from ${config.web.distPath}`);
  }
}

function setupSwagger(app: NestExpressApplication): void {
  const document = buildOpenApiDocument(
    API_VERSION,
  ) as unknown as OpenAPIObject;
  SwaggerModule.setup(`${API_PREFIX.replace(/^\//, '')}/docs`, app, document, {
    jsonDocumentUrl: `${API_PREFIX.replace(/^\//, '')}/openapi.json`,
  });
}

void bootstrap();
