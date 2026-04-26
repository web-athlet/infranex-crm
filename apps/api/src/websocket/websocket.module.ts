import { Module } from '@nestjs/common';

import { AuthSharedModule } from '../shared/guards/auth-shared.module';
import { SocketAuthService } from './socket-auth.service';
import { WebsocketGateway } from './websocket.gateway';

@Module({
  imports: [AuthSharedModule],
  providers: [SocketAuthService, WebsocketGateway],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}
