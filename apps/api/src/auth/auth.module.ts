import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG, type AppConfig } from '../config/env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.auth.accessSecret,
        signOptions: {
          expiresIn: config.auth.accessTtlSeconds,
          issuer: 'gameshelf',
        },
        verifyOptions: { issuer: 'gameshelf' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, RefreshTokenService],
  exports: [JwtModule, RefreshTokenService],
})
export class AuthModule {}
