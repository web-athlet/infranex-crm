import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { AuthenticatedAuthUser, AuthService } from '../auth.service';

type RequestWithRefreshAuth = {
  headers: {
    cookie?: string | string[] | undefined;
  };
  user?: AuthenticatedAuthUser;
  refreshTokenCookieValue?: string;
};

@Injectable()
export class JwtRefreshGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithRefreshAuth>();
    const result = await this.authService.authenticateRefreshTokenCookie(request.headers.cookie);

    request.user = result.user;
    request.refreshTokenCookieValue = result.refreshTokenCookieValue;

    return true;
  }
}
