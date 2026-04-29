import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthModule } from '../../modules/auth/auth.module';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtAuthService } from './jwt-auth.service';

@Module({
  imports: [JwtModule.register({}), AuthModule],
  providers: [JwtAuthGuard, JwtAuthService],
  exports: [JwtAuthGuard, JwtAuthService],
})
export class AuthSharedModule {}
