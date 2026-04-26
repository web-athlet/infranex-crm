import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { AuthenticatedUser } from '../shared/dto/authenticated-user.dto';
import { SocketAuthService } from './socket-auth.service';

type ClientToServerEvents = Record<string, never>;
type ServerToClientEvents = Record<string, (data: unknown) => void>;
type InterServerEvents = Record<string, never>;
type SocketData = {
  auth?: AuthenticatedUser;
};
type AuthenticatedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
type WebsocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

function parseCorsOrigins(value: string | undefined) {
  if (!value) {
    return false;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getHandshakeToken(client: AuthenticatedSocket) {
  const authToken = client.handshake.auth.token;
  const authorization = client.handshake.headers.authorization;

  if (typeof authToken === 'string' && authToken.length > 0) {
    return authToken;
  }

  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length);
  }

  return null;
}

@WebSocketGateway({
  namespace: 'realtime',
  cors: {
    origin: parseCorsOrigins(process.env.API_CORS_ORIGIN),
    credentials: true,
  },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: WebsocketServer;

  constructor(private readonly socketAuthService: SocketAuthService) {}

  async handleConnection(client: AuthenticatedSocket) {
    const token = getHandshakeToken(client);

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const auth = await this.socketAuthService.verifyHandshakeToken(token);
      client.data.auth = auth;
      await client.join(this.tenantRoom(auth.tenantId));
      await client.join(this.userRoom(auth.tenantId, auth.userId));
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: AuthenticatedSocket) {
    return undefined;
  }

  emitToUser(tenantId: string, userId: string, event: string, data: unknown) {
    this.server.to(this.userRoom(tenantId, userId)).emit(event, data);
  }

  emitToTenant(tenantId: string, event: string, data: unknown) {
    this.server.to(this.tenantRoom(tenantId)).emit(event, data);
  }

  private userRoom(tenantId: string, userId: string) {
    return `tenant:${tenantId}:user:${userId}`;
  }

  private tenantRoom(tenantId: string) {
    return `tenant:${tenantId}`;
  }
}
