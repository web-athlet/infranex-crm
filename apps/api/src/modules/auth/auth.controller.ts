import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { AUTH_THROTTLE_LIMITS } from './auth-throttle.config';
import {
  AccessTokenResponse,
  AuthenticatedAuthUser,
  AuthService,
  REFRESH_TOKEN_COOKIE_NAME,
  RefreshCookieOptions,
  SafeUserPayload,
} from './auth.service';
import { CurrentRefreshToken, CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

type CookieResponse = {
  cookie: (name: string, value: string, options: RefreshCookieOptions) => void;
  clearCookie: (name: string, options: Omit<RefreshCookieOptions, 'maxAge'>) => void;
};

type LoginResponse = AccessTokenResponse & {
  user: SafeUserPayload;
};

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
  ): Promise<LoginResponse> {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(response, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
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
    const result = await this.authService.refresh(user, refreshToken);
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
}
