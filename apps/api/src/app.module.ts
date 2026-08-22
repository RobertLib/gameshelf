import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/config.module';
import { APP_CONFIG, type AppConfig } from './config/env';
import { PrismaModule } from './common/prisma/prisma.module';
import { AccessTokenGuard } from './common/auth/access-token.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ContractResponseInterceptor } from './common/interceptors/contract-response.interceptor';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { GamesModule } from './games/games.module';
import { UploadsModule } from './uploads/uploads.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        throttlers: [
          {
            name: 'default',
            limit: config.throttle.limit,
            ttl: config.throttle.ttlSeconds * 1000,
          },
        ],
      }),
    }),
    AuthModule,
    CatalogModule,
    GamesModule,
    UploadsModule,
  ],
  controllers: [HealthController],
  providers: [
    /**
     * The registration order is also the execution order: a flood of requests is
     * trimmed first, and only then is the token verified.
     */
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    {
      provide: APP_FILTER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new AllExceptionsFilter(config.isProduction),
    },
    { provide: APP_INTERCEPTOR, useClass: ContractResponseInterceptor },
  ],
})
export class AppModule {}
