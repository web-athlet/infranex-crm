import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtAuthService } from './jwt-auth.service';

@Module({
  imports: [JwtModule.register({})],
  providers: [JwtAuthGuard, JwtAuthService],
  exports: [JwtAuthGuard, JwtAuthService],
})
export class AuthSharedModule {}
