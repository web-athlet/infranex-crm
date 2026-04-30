import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';

import { AUTH_THROTTLE_LIMITS } from './auth-throttle.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CryptoService } from './crypto.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { MailService } from './mail.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    JwtModule.register({}),
    PassportModule,
    ThrottlerModule.forRoot([AUTH_THROTTLE_LIMITS.default]),
  ],
  controllers: [AuthController],
  providers: [AuthService, CryptoService, MailService, JwtStrategy, JwtAuthGuard, JwtRefreshGuard],
  exports: [AuthService, CryptoService, JwtAuthGuard, JwtRefreshGuard],
})
export class AuthModule {}
