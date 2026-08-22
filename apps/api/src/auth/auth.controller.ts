import { Controller, Inject, Req, Res } from '@nestjs/common';
import {
  contract,
  type ChangePasswordInput,
  type LoginInput,
  type Output,
  type RegisterInput,
  type UpdateProfileInput,
} from '@gameshelf/contracts';
import type { Request, Response } from 'express';
import { ContractBody, Endpoint } from '../common/http/endpoint.decorator';
import { ThrottleAuth, ThrottleRefresh } from '../common/http/throttling';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../common/auth/current-user';
import { AppErrors } from '../common/errors';
import { APP_CONFIG, type AppConfig } from '../config/env';
import { AuthService, type SessionResult } from './auth.service';
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie';

/**
 * Both the paths and the HTTP methods come from `contract.auth`, the controller
 * copies them nowhere. The return types are `Output<typeof contract.auth.x>`, so
 * the compiler fails should a response stop matching the contract.
 */
@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Both registration and sign-in have a stricter limit than the rest of the API. */
  @ThrottleAuth()
  @Endpoint(contract.auth.register)
  async register(
    @ContractBody(contract.auth.register) body: RegisterInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Output<typeof contract.auth.register>> {
    const result = await this.auth.register(body, userAgentOf(request));
    return this.completeSession(response, result);
  }

  @ThrottleAuth()
  @Endpoint(contract.auth.login)
  async login(
    @ContractBody(contract.auth.login) body: LoginInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Output<typeof contract.auth.login>> {
    const result = await this.auth.login(body, userAgentOf(request));
    return this.completeSession(response, result);
  }

  @ThrottleRefresh()
  @Endpoint(contract.auth.refresh)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Output<typeof contract.auth.refresh>> {
    const token = readRefreshCookie(request);
    if (!token) {
      clearRefreshCookie(response, this.config);
      throw AppErrors.refreshTokenInvalid();
    }

    try {
      const result = await this.auth.refresh(token, userAgentOf(request));
      return this.completeSession(response, result);
    } catch (error) {
      // There is no point keeping an invalid cookie in the browser - the next
      // attempt would end the same way.
      clearRefreshCookie(response, this.config);
      throw error;
    }
  }

  @Endpoint(contract.auth.logout)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Output<typeof contract.auth.logout>> {
    await this.auth.logout(readRefreshCookie(request));
    clearRefreshCookie(response, this.config);
    return { ok: true };
  }

  @Endpoint(contract.auth.me)
  me(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Output<typeof contract.auth.me>> {
    return this.auth.getProfile(user.id);
  }

  @Endpoint(contract.auth.updateProfile)
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @ContractBody(contract.auth.updateProfile) body: UpdateProfileInput,
  ): Promise<Output<typeof contract.auth.updateProfile>> {
    return this.auth.updateProfile(user.id, body);
  }

  @Endpoint(contract.auth.changePassword)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @ContractBody(contract.auth.changePassword) body: ChangePasswordInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Output<typeof contract.auth.changePassword>> {
    const result = await this.auth.changePassword(
      user.id,
      body,
      userAgentOf(request),
    );
    // The other sessions are gone; the current one gets a fresh cookie.
    setRefreshCookie(
      response,
      this.config,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );
    return { ok: true };
  }

  private completeSession(
    response: Response,
    result: SessionResult,
  ): SessionResult['session'] {
    setRefreshCookie(
      response,
      this.config,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );
    return result.session;
  }
}

function userAgentOf(request: Request): string | undefined {
  return request.headers['user-agent'];
}
