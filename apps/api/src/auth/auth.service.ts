import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User as UserRecord } from '@prisma/client';
import type {
  AuthSession,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
  User,
} from '@gameshelf/contracts';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppErrors } from '../common/errors';
import { APP_CONFIG, type AppConfig } from '../config/env';
import { PasswordService } from './password.service';
import { RefreshTokenService } from './refresh-token.service';
import type { AccessTokenPayload } from '../common/auth/access-token.guard';

/**
 * The result of an operation that creates or refreshes a session.
 * The controller turns the refresh token into an httpOnly cookie - it never
 * reaches the response body.
 */
export interface SessionResult {
  session: AuthSession;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(
    input: RegisterInput,
    userAgent?: string,
  ): Promise<SessionResult> {
    const email = normalizeEmail(input.email);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw AppErrors.emailTaken(email);

    const user = await this.prisma.user.create({
      data: {
        email,
        displayName: input.displayName,
        passwordHash: await this.passwords.hash(input.password),
      },
    });

    return this.startSession(user, userAgent);
  }

  async login(input: LoginInput, userAgent?: string): Promise<SessionResult> {
    const email = normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Verify against a dummy hash so that a non-existent account does not
      // answer noticeably faster than one with a wrong password.
      await this.passwords.burnTime(input.password);
      throw AppErrors.invalidCredentials();
    }

    const valid = await this.passwords.verify(
      user.passwordHash,
      input.password,
    );
    if (!valid) throw AppErrors.invalidCredentials();

    return this.startSession(user, userAgent);
  }

  /** Rotates the refresh token and issues a new access token. */
  async refresh(rawToken: string, userAgent?: string): Promise<SessionResult> {
    const { userId, issued } = await this.refreshTokens.rotate(
      rawToken,
      userAgent,
    );

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppErrors.refreshTokenInvalid();

    return {
      session: {
        user: toUserDto(user),
        accessToken: await this.signAccessToken(user),
        expiresIn: this.config.auth.accessTtlSeconds,
      },
      refreshToken: issued.token,
      refreshTokenExpiresAt: issued.expiresAt,
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken) await this.refreshTokens.revoke(rawToken);
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppErrors.unauthenticated();
    return toUserDto(user);
  }

  /**
   * The display name is an ordinary edit; the email is not.
   *
   * The email is the login name, so changing it moves the account somewhere
   * else - and unlike a password change it used to cost nothing but a valid
   * access token. Hence the current password, but only when the address really
   * differs: sending the same one back is not a change, and demanding a
   * password for renaming yourself would be absurd.
   */
  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppErrors.unauthenticated();

    const email = input.email ? normalizeEmail(input.email) : undefined;
    const emailChanges = email !== undefined && email !== user.email;

    if (emailChanges) {
      if (!input.currentPassword) throw AppErrors.currentPasswordRequired();

      const valid = await this.passwords.verify(
        user.passwordHash,
        input.currentPassword,
      );
      if (!valid) throw AppErrors.invalidCurrentPassword();

      const conflict = await this.prisma.user.findUnique({ where: { email } });
      if (conflict && conflict.id !== userId) throw AppErrors.emailTaken(email);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.displayName ? { displayName: input.displayName } : {}),
        ...(emailChanges ? { email } : {}),
      },
    });

    return toUserDto(updated);
  }

  /**
   * Changing the password invalidates every existing session. The current
   * browser immediately gets a new session, other devices will have to sign in
   * again - which is exactly what we want after a password change.
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    userAgent?: string,
  ): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppErrors.unauthenticated();

    const valid = await this.passwords.verify(
      user.passwordHash,
      input.currentPassword,
    );
    if (!valid) throw AppErrors.invalidCurrentPassword();

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(input.newPassword) },
    });

    await this.refreshTokens.revokeAllForUser(userId);
    return this.startSession(updated, userAgent);
  }

  private async startSession(
    user: UserRecord,
    userAgent?: string,
  ): Promise<SessionResult> {
    const issued = await this.refreshTokens.issue(user.id, userAgent);

    return {
      session: {
        user: toUserDto(user),
        accessToken: await this.signAccessToken(user),
        expiresIn: this.config.auth.accessTtlSeconds,
      },
      refreshToken: issued.token,
      refreshTokenExpiresAt: issued.expiresAt,
    };
  }

  private signAccessToken(user: UserRecord): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email };
    return this.jwt.signAsync(payload);
  }
}

/** Without normalization "John@Example.com" and "john@example.com" would be two different accounts. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Picks from the database record only what is allowed to leave. */
function toUserDto(user: UserRecord): User {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  };
}
