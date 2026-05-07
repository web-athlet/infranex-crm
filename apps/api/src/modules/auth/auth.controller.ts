import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { AUTH_THROTTLE_LIMITS } from './auth-throttle.config';
import {
  AccessTokenResponse,
  AuthenticatedAuthUser,
  AuthService,
  CompletedLoginResult,
  LoginResult,
  OAuthConnectionResult,
  REFRESH_TOKEN_COOKIE_NAME,
  RefreshCookieOptions,
  SafeUserPayload,
  TwoFactorLoginChallengeResponse,
  TwoFactorSetupRequiredResponse,
  TwoFactorSetupResponse,
  TwoFactorVerifyResponse,
} from './auth.service';
import { CurrentRefreshToken, CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TwoFactorDisableDto } from './dto/two-factor-disable.dto';
import { TwoFactorGenerateDto } from './dto/two-factor-generate.dto';
import { TwoFactorValidateDto } from './dto/two-factor-validate.dto';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

type CookieResponse = {
  cookie: (name: string, value: string, options: RefreshCookieOptions) => void;
  clearCookie: (name: string, options: Omit<RefreshCookieOptions, 'maxAge'>) => void;
};

type RedirectResponse = {
  redirect: (url: string) => void;
};

type LoginResponse = AccessTokenResponse & {
  user: SafeUserPayload;
};

type LoginControllerResponse =
  | LoginResponse
  | TwoFactorLoginChallengeResponse
  | TwoFactorSetupRequiredResponse;

type LogoutResponse = {
  success: true;
};

type SuccessResponse = {
  success: true;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: AUTH_THROTTLE_LIMITS.register })
  async register(@Body() dto: RegisterDto): Promise<SafeUserPayload> {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: AUTH_THROTTLE_LIMITS.login })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<LoginControllerResponse> {
    const result = await this.authService.login(dto);

    if (!this.isCompletedLoginResult(result)) {
      return result;
    }

    this.setRefreshCookie(response, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Get('google')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ default: AUTH_THROTTLE_LIMITS.oauthStart })
  async connectGoogle(
    @CurrentUser() user: AuthenticatedAuthUser,
    @Res() response: RedirectResponse,
  ): Promise<void> {
    const authorizationUrl = await this.authService.createOAuthAuthorizationUrl(user, 'google');
    response.redirect(authorizationUrl);
  }

  @Get('google/callback')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: AUTH_THROTTLE_LIMITS.oauthCallback })
  async connectGoogleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
  ): Promise<OAuthConnectionResult> {
    return this.authService.connectOAuthProvider('google', code, state, error);
  }

  @Get('microsoft')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ default: AUTH_THROTTLE_LIMITS.oauthStart })
  async connectMicrosoft(
    @CurrentUser() user: AuthenticatedAuthUser,
    @Res() response: RedirectResponse,
  ): Promise<void> {
    const authorizationUrl = await this.authService.createOAuthAuthorizationUrl(user, 'microsoft');
    response.redirect(authorizationUrl);
  }

  @Get('microsoft/callback')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: AUTH_THROTTLE_LIMITS.oauthCallback })
  async connectMicrosoftCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
  ): Promise<OAuthConnectionResult> {
    return this.authService.connectOAuthProvider('microsoft', code, state, error);
  }

  @Post('2fa/generate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: AUTH_THROTTLE_LIMITS.twoFactorGenerate })
  async generateTwoFactorSetup(
    @Body() dto: TwoFactorGenerateDto,
    @Headers('authorization') authorization: string | undefined,
  ): Promise<TwoFactorSetupResponse> {
    return this.authService.generateTwoFactorSetup(authorization, dto);
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: AUTH_THROTTLE_LIMITS.twoFactorVerify })
  async verifyTwoFactorSetup(
    @Body() dto: TwoFactorVerifyDto,
    @Headers('authorization') authorization: string | undefined,
  ): Promise<TwoFactorVerifyResponse> {
    return this.authService.verifyTwoFactorSetup(authorization, dto);
  }

  @Post('2fa/validate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: AUTH_THROTTLE_LIMITS.twoFactorValidate })
  async validateTwoFactorLogin(
    @Body() dto: TwoFactorValidateDto,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AccessTokenResponse> {
    const result = await this.authService.validateTwoFactorLogin(dto);
    this.setRefreshCookie(response, result.refreshToken);

    return {
      accessToken: result.accessToken,
    };
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ default: AUTH_THROTTLE_LIMITS.twoFactorDisable })
  async disableTwoFactor(
    @CurrentUser() user: AuthenticatedAuthUser,
    @Body() dto: TwoFactorDisableDto,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<SuccessResponse> {
    await this.authService.disableTwoFactor(user, dto);
    this.clearRefreshCookie(response);

    return { success: true };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: AUTH_THROTTLE_LIMITS.forgotPassword })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<SuccessResponse> {
    await this.authService.forgotPassword(dto);

    return { success: true };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: AUTH_THROTTLE_LIMITS.resetPassword })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<SuccessResponse> {
    await this.authService.resetPassword(dto);

    return { success: true };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard, JwtRefreshGuard)
  @Throttle({ default: AUTH_THROTTLE_LIMITS.refresh })
  async refresh(
    @CurrentUser() user: AuthenticatedAuthUser,
    @CurrentRefreshToken() refreshToken: string,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AccessTokenResponse> {
    let result: CompletedLoginResult;

    try {
      result = await this.authService.refresh(user, refreshToken);
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        this.clearRefreshCookie(response);
      }

      throw error;
    }

    this.setRefreshCookie(response, result.refreshToken);

    return {
      accessToken: result.accessToken,
    };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ default: AUTH_THROTTLE_LIMITS.changePassword })
  async changePassword(
    @CurrentUser() user: AuthenticatedAuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AccessTokenResponse> {
    const result = await this.authService.changePassword(user, dto);
    this.clearRefreshCookie(response);

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  async logout(
    @CurrentUser() user: AuthenticatedAuthUser,
    @CurrentRefreshToken() refreshToken: string,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<LogoutResponse> {
    await this.authService.logout(user, refreshToken);
    this.clearRefreshCookie(response);

    return { success: true };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logoutAll(
    @CurrentUser() user: AuthenticatedAuthUser,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<LogoutResponse> {
    await this.authService.logoutAll(user);
    this.clearRefreshCookie(response);

    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedAuthUser): SafeUserPayload {
    return this.authService.toSafeUser(user);
  }

  private setRefreshCookie(response: CookieResponse, refreshToken: string): void {
    response.cookie(
      REFRESH_TOKEN_COOKIE_NAME,
      refreshToken,
      this.authService.getRefreshCookieOptions(),
    );
  }

  private clearRefreshCookie(response: CookieResponse): void {
    response.clearCookie(
      REFRESH_TOKEN_COOKIE_NAME,
      this.authService.getClearRefreshCookieOptions(),
    );
  }

  private isCompletedLoginResult(result: LoginResult): result is CompletedLoginResult {
    return 'refreshToken' in result;
  }
}
