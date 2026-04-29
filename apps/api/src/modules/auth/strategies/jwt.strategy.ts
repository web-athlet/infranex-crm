import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { getJwtAccessSecret } from '../auth.config';
import { AuthenticatedAuthUser, AuthService } from '../auth.service';

type JwtPayload = {
  sub?: unknown;
  pwChangedAt?: unknown;
  platformRole?: unknown;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtAccessSecret(),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedAuthUser> {
    return this.authService.validateAccessPayload(payload);
  }
}
