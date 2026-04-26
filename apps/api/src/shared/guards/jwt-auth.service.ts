import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AuthenticatedUser } from '../dto/authenticated-user.dto';

type JwtPayload = {
  sub?: unknown;
  tenantId?: unknown;
};

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

@Injectable()
export class JwtAuthService {
  constructor(private readonly jwtService: JwtService) {}

  async verifyBearerToken(token: string): Promise<AuthenticatedUser> {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new UnauthorizedException('JWT authentication is not configured');
    }

    const payload = await this.jwtService.verifyAsync<JwtPayload>(token, { secret });

    if (!isString(payload.sub) || !isString(payload.tenantId)) {
      throw new UnauthorizedException('Invalid JWT payload');
    }

    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
    };
  }
}
