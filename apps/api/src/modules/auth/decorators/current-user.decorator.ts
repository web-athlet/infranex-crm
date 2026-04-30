import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { AuthenticatedAuthUser } from '../auth.service';

type RequestWithUser = {
  user?: AuthenticatedAuthUser;
  refreshTokenCookieValue?: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedAuthUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();

    if (!request.user) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    return request.user;
  },
);

export const CurrentRefreshToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();

    if (!request.refreshTokenCookieValue) {
      throw new UnauthorizedException('Missing refresh token');
    }

    return request.refreshTokenCookieValue;
  },
);
