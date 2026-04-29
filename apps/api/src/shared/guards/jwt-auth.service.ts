import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { getJwtAccessSecret } from '../../modules/auth/auth.config';
import { AuthService } from '../../modules/auth/auth.service';
import { AuthenticatedUser } from '../dto/authenticated-user.dto';

type JwtPayload = {
  sub?: unknown;
  pwChangedAt?: unknown;
  platformRole?: unknown;
};

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

@Injectable()
export class JwtAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async verifyBearerToken(token: string): Promise<AuthenticatedUser> {
    const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: getJwtAccessSecret(),
    });

    if (!isString(payload.sub) || !isString(payload.pwChangedAt)) {
      throw new UnauthorizedException('Invalid JWT payload');
    }

    const user = await this.authService.validateAccessPayload(payload);

    return {
      userId: user.id,
      pwChangedAt: payload.pwChangedAt,
      ...(isString(payload.platformRole) ? { platformRole: user.platformRole } : {}),
    };
  }
}
