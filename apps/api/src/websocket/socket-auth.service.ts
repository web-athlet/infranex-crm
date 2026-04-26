import { Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

import { AuthenticatedUser } from '../shared/dto/authenticated-user.dto';
import { JwtAuthService } from '../shared/guards/jwt-auth.service';

@Injectable()
export class SocketAuthService {
  constructor(private readonly jwtAuthService: JwtAuthService) {}

  async verifyHandshakeToken(token: string): Promise<AuthenticatedUser> {
    try {
      return await this.jwtAuthService.verifyBearerToken(token);
    } catch {
      throw new WsException('Invalid WebSocket token payload');
    }
  }
}
