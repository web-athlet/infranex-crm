import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleDestroy,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  MembershipRole,
  PlatformRole,
  Prisma,
  PrismaClient,
  TokenRevocationReason,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';

import { getJwtAccessSecret } from './auth.config';
import { CryptoService } from './crypto.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from './mail.service';
import { isBcryptPasswordInputLengthValid } from './password.util';

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_SALT_ROUNDS = 12;
const REFRESH_TOKEN_SALT_ROUNDS = 10;
const REFRESH_TOKEN_SECRET_BYTES = 32;
const MAX_BCRYPT_INPUT_BYTES = 72;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_SELECTOR_BYTES = 16;
const PASSWORD_RESET_VERIFIER_BYTES = 32;
const FORGOT_PASSWORD_MIN_RESPONSE_MS = 400;

export const REFRESH_TOKEN_COOKIE_NAME = 'infranex_refresh_token';

type JwtPayload = {
  sub?: unknown;
  pwChangedAt?: unknown;
  platformRole?: unknown;
};

type SafeUserSource = {
  id: string;
  email: string;
  name: string | null;
  platformRole: PlatformRole;
  createdAt: Date;
  updatedAt: Date;
};

export type SafeUserPayload = SafeUserSource;

export type AuthenticatedAuthUser = SafeUserPayload & {
  passwordChangedAt: Date | null;
};

type TokenReadyAuthUser = AuthenticatedAuthUser & {
  passwordChangedAt: Date;
};

export type AccessTokenResponse = {
  accessToken: string;
};

export type LoginResult = AccessTokenResponse & {
  refreshToken: string;
  user: SafeUserPayload;
};

export type RefreshCookieOptions = {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge?: number;
};

type RefreshTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
};

type AuthenticatedRefreshTokenCookie = {
  user: AuthenticatedAuthUser;
  refreshTokenCookieValue: string;
};

type RotationResult =
  | {
      status: 'rotated';
      refreshToken: string;
    }
  | {
      status: 'invalid';
    }
  | {
      status: 'replay';
    };

type RefreshTokenCookieParts = {
  tokenId: string;
  rawSecret: string;
};

type PasswordResetTokenParts = {
  selector: string;
  verifier: string;
};

type RefreshTokenMaterial = {
  familyId: string;
  tokenId: string;
  rawSecret: string;
  tokenHash: string;
  expiresAt: Date;
};

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function passwordChangedAtClaim(value: Date): string {
  return value.toISOString();
}

function decodeCookieValue(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function parseRefreshTokenCookieValue(value: string): RefreshTokenCookieParts | null {
  const parts = value.split('.');

  if (parts.length !== 2) {
    return null;
  }

  const [tokenId, rawSecret] = parts;

  if (!tokenId || !rawSecret || Buffer.byteLength(rawSecret, 'utf8') > MAX_BCRYPT_INPUT_BYTES) {
    return null;
  }

  return { tokenId, rawSecret };
}

function createOpaqueRefreshSecret(): string {
  return randomBytes(REFRESH_TOKEN_SECRET_BYTES).toString('base64url');
}

function createPasswordResetTokenParts(): PasswordResetTokenParts {
  return {
    selector: randomBytes(PASSWORD_RESET_SELECTOR_BYTES).toString('hex'),
    verifier: randomBytes(PASSWORD_RESET_VERIFIER_BYTES).toString('hex'),
  };
}

function serializePasswordResetToken(parts: PasswordResetTokenParts): string {
  return `${parts.selector}.${parts.verifier}`;
}

function parsePasswordResetToken(token: string): PasswordResetTokenParts | null {
  const parts = token.split('.');

  if (parts.length !== 2) {
    return null;
  }

  const [selector, verifier] = parts;
  const hexPattern = /^[a-f0-9]+$/;

  if (
    selector.length !== PASSWORD_RESET_SELECTOR_BYTES * 2 ||
    verifier.length !== PASSWORD_RESET_VERIFIER_BYTES * 2 ||
    !hexPattern.test(selector) ||
    !hexPattern.test(verifier)
  ) {
    return null;
  }

  return { selector, verifier };
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

@Injectable()
export class AuthService implements OnModuleDestroy {
  private readonly prisma = new PrismaClient();

  constructor(
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly cryptoService: CryptoService,
  ) {
    void this.cryptoService;
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async register(dto: RegisterDto): Promise<SafeUserPayload> {
    const email = normalizeEmail(dto.email);
    this.assertPasswordWithinBcryptLimit(dto.password);

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const now = new Date();
    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);

    try {
      return await this.prisma.user.create({
        data: {
          email,
          name: dto.name,
          passwordHash,
          passwordChangedAt: now,
        },
        select: this.safeUserSelect(),
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Email is already registered');
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const email = normalizeEmail(dto.email);

    if (!isBcryptPasswordInputLengthValid(dto.password)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        ...this.safeUserSelect(),
        passwordHash: true,
        passwordChangedAt: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const refreshTokenMaterial = await this.createRefreshTokenMaterial();
    const loginSession = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.lockUserAuthSessions(tx, user.id);

      const lockedUser = await tx.user.findUnique({
        where: { id: user.id },
        select: {
          ...this.safeUserSelect(),
          passwordHash: true,
          passwordChangedAt: true,
          deletedAt: true,
        },
      });

      if (!lockedUser || lockedUser.deletedAt) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const lockedPasswordMatches = await bcrypt.compare(dto.password, lockedUser.passwordHash);

      if (!lockedPasswordMatches) {
        throw new UnauthorizedException('Invalid email or password');
      }

      let passwordChangedAt = lockedUser.passwordChangedAt;

      if (!passwordChangedAt) {
        const updated = await tx.user.update({
          where: { id: lockedUser.id },
          data: { passwordChangedAt: new Date() },
          select: { passwordChangedAt: true },
        });
        passwordChangedAt = updated.passwordChangedAt;
      }

      if (!passwordChangedAt) {
        throw new UnauthorizedException('Invalid token payload');
      }

      const authenticatedUser: TokenReadyAuthUser = {
        ...this.toSafeUser(lockedUser),
        passwordChangedAt,
      };

      await this.createRefreshTokenInTransaction(tx, authenticatedUser, refreshTokenMaterial);

      await tx.user.update({
        where: { id: lockedUser.id },
        data: { lastLoginAt: new Date() },
        select: { id: true },
      });

      return {
        authenticatedUser,
        refreshToken: this.serializeRefreshTokenCookieValue(
          refreshTokenMaterial.tokenId,
          refreshTokenMaterial.rawSecret,
        ),
      };
    });

    const accessToken = await this.signAccessToken(loginSession.authenticatedUser);

    return {
      accessToken,
      refreshToken: loginSession.refreshToken,
      user: this.toSafeUser(loginSession.authenticatedUser),
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const startedAt = Date.now();

    try {
      this.mailService.assertPasswordResetEmailAvailable();

      const email = normalizeEmail(dto.email);
      const tokenParts = createPasswordResetTokenParts();
      const tokenHash = await bcrypt.hash(tokenParts.verifier, REFRESH_TOKEN_SALT_ROUNDS);
      const now = new Date();

      const user = await this.prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          deletedAt: true,
        },
      });

      if (!user || user.deletedAt) {
        return;
      }

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Only the latest reset email remains usable for an account.
        await tx.passwordReset.updateMany({
          where: {
            userId: user.id,
            usedAt: null,
          },
          data: {
            usedAt: now,
          },
        });

        await tx.passwordReset.create({
          data: {
            userId: user.id,
            selector: tokenParts.selector,
            tokenHash,
            expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
          },
          select: { id: true },
        });
      });

      await this.mailService.sendPasswordResetEmail({
        email: user.email,
        token: serializePasswordResetToken(tokenParts),
      });
    } finally {
      await this.waitForForgotPasswordTimingFloor(startedAt);
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    this.assertPasswordWithinBcryptLimit(dto.newPassword);

    const parsedToken = parsePasswordResetToken(dto.token);

    if (!parsedToken) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordReset = await this.prisma.passwordReset.findUnique({
      where: { selector: parsedToken.selector },
      select: {
        id: true,
        userId: true,
        tokenHash: true,
        expiresAt: true,
        usedAt: true,
        user: {
          select: {
            deletedAt: true,
          },
        },
      },
    });

    const now = new Date();

    if (
      !passwordReset ||
      passwordReset.usedAt ||
      passwordReset.expiresAt.getTime() <= now.getTime() ||
      passwordReset.user.deletedAt
    ) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const tokenMatches = await bcrypt.compare(parsedToken.verifier, passwordReset.tokenHash);

    if (!tokenMatches) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, PASSWORD_SALT_ROUNDS);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.lockUserAuthSessions(tx, passwordReset.userId);

      const usedToken = await tx.passwordReset.updateMany({
        where: {
          id: passwordReset.id,
          usedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          usedAt: now,
        },
      });

      if (usedToken.count !== 1) {
        throw new BadRequestException('Invalid or expired password reset token');
      }

      await tx.user.update({
        where: { id: passwordReset.userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
        },
        select: { id: true },
      });

      await this.invalidateActiveRefreshTokenFamiliesForUserInTransaction(
        tx,
        passwordReset.userId,
        now,
      );
    });
  }

  async changePassword(
    user: AuthenticatedAuthUser,
    dto: ChangePasswordDto,
  ): Promise<AccessTokenResponse> {
    this.assertPasswordWithinBcryptLimit(dto.newPassword);

    if (!isBcryptPasswordInputLengthValid(dto.oldPassword)) {
      throw new UnauthorizedException('Invalid old password');
    }

    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        ...this.safeUserSelect(),
        passwordHash: true,
        passwordChangedAt: true,
        deletedAt: true,
      },
    });

    if (!currentUser || currentUser.deletedAt) {
      throw new UnauthorizedException('Invalid old password');
    }

    const passwordMatches = await bcrypt.compare(dto.oldPassword, currentUser.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid old password');
    }

    const now = new Date();
    const passwordHash = await bcrypt.hash(dto.newPassword, PASSWORD_SALT_ROUNDS);
    const updatedUser = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.lockUserAuthSessions(tx, currentUser.id);

      const lockedUser = await tx.user.findUnique({
        where: { id: currentUser.id },
        select: {
          ...this.safeUserSelect(),
          passwordHash: true,
          deletedAt: true,
        },
      });

      if (!lockedUser || lockedUser.deletedAt) {
        throw new UnauthorizedException('Invalid old password');
      }

      const lockedPasswordMatches = await bcrypt.compare(dto.oldPassword, lockedUser.passwordHash);

      if (!lockedPasswordMatches) {
        throw new UnauthorizedException('Invalid old password');
      }

      const updated = await tx.user.update({
        where: { id: lockedUser.id },
        data: {
          passwordHash,
          passwordChangedAt: now,
        },
        select: {
          ...this.safeUserSelect(),
          passwordChangedAt: true,
        },
      });

      await this.invalidateActiveRefreshTokenFamiliesForUserInTransaction(tx, lockedUser.id, now);

      return updated;
    });

    // Change-password is access-token authenticated, so the current refresh
    // token identity is not available safely here. Revoke all sessions and
    // return a fresh short-lived access token.
    return {
      accessToken: await this.signAccessToken({
        ...this.toSafeUser(updatedUser),
        passwordChangedAt: now,
      }),
    };
  }

  async refresh(user: AuthenticatedAuthUser, rawRefreshToken: string): Promise<LoginResult> {
    const existingToken = await this.findStoredRefreshToken(user.id, rawRefreshToken);

    if (!existingToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existingToken.revokedAt) {
      await this.compromiseRefreshTokenFamily(existingToken.familyId);
      this.recordRefreshReplayDetected(user.id, existingToken.familyId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (existingToken.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const authenticatedUser = await this.ensurePasswordChangedAt(user);
    const replacement = await this.rotateRefreshToken(authenticatedUser, existingToken);
    const accessToken = await this.signAccessToken(authenticatedUser);

    return {
      accessToken,
      refreshToken: replacement,
      user: this.toSafeUser(authenticatedUser),
    };
  }

  async logout(user: AuthenticatedAuthUser, rawRefreshToken: string): Promise<void> {
    const existingToken = await this.findStoredRefreshToken(user.id, rawRefreshToken);

    if (!existingToken || existingToken.revokedAt) {
      return;
    }

    await this.prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: {
        revokedAt: new Date(),
        revocationReason: TokenRevocationReason.LOGOUT,
      },
      select: { id: true },
    });
  }

  async logoutAll(user: AuthenticatedAuthUser): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.lockUserAuthSessions(tx, user.id);
      await this.invalidateActiveRefreshTokenFamiliesForUserInTransaction(tx, user.id, now);
    });
  }

  async validateAccessPayload(payload: JwtPayload): Promise<AuthenticatedAuthUser> {
    return this.validateAuthenticatedPayload(payload);
  }

  async getActiveTenantMembershipRole(
    userId: string,
    tenantId: string,
  ): Promise<MembershipRole | null> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        tenantId,
        isActive: true,
        deletedAt: null,
        tenant: {
          deletedAt: null,
        },
        user: {
          deletedAt: null,
        },
      },
      select: {
        role: true,
      },
    });

    return membership?.role ?? null;
  }

  getRefreshTokenFromCookieHeader(cookieHeader: string | string[] | undefined): string | null {
    const headerValue = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;

    if (!headerValue) {
      return null;
    }

    const cookies = headerValue.split(';');

    for (const cookie of cookies) {
      const [rawName, ...rawValueParts] = cookie.split('=');
      const name = rawName?.trim();

      if (name === REFRESH_TOKEN_COOKIE_NAME) {
        const value = rawValueParts.join('=').trim();
        return value.length > 0 ? decodeCookieValue(value) : null;
      }
    }

    return null;
  }

  async authenticateRefreshTokenCookie(
    cookieHeader: string | string[] | undefined,
  ): Promise<AuthenticatedRefreshTokenCookie> {
    const cookieValue = this.getRefreshTokenFromCookieHeader(cookieHeader);

    if (!cookieValue) {
      throw new UnauthorizedException('Missing refresh token');
    }

    const token = await this.findStoredRefreshTokenByCookieValue(cookieValue);

    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: token.userId },
      select: {
        ...this.safeUserSelect(),
        passwordChangedAt: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      user: {
        ...this.toSafeUser(user),
        passwordChangedAt: user.passwordChangedAt,
      },
      refreshTokenCookieValue: cookieValue,
    };
  }

  getRefreshCookieOptions(): RefreshCookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV !== 'development',
      path: '/api/v1/auth',
      maxAge: REFRESH_TOKEN_TTL_MS,
    };
  }

  getClearRefreshCookieOptions(): Omit<RefreshCookieOptions, 'maxAge'> {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV !== 'development',
      path: '/api/v1/auth',
    };
  }

  toSafeUser(user: SafeUserSource): SafeUserPayload {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      platformRole: user.platformRole,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async validateAuthenticatedPayload(payload: JwtPayload): Promise<TokenReadyAuthUser> {
    if (!isString(payload.sub) || !isString(payload.pwChangedAt)) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        ...this.safeUserSelect(),
        passwordChangedAt: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt || !user.passwordChangedAt) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (payload.pwChangedAt !== passwordChangedAtClaim(user.passwordChangedAt)) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      ...this.toSafeUser(user),
      passwordChangedAt: user.passwordChangedAt,
    };
  }

  private async signAccessToken(user: TokenReadyAuthUser): Promise<string> {
    return this.jwtService.signAsync(this.buildTokenPayload(user), {
      secret: this.getAccessTokenSecret(),
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });
  }

  private async ensurePasswordChangedAt(user: AuthenticatedAuthUser): Promise<TokenReadyAuthUser> {
    if (user.passwordChangedAt) {
      return {
        ...user,
        passwordChangedAt: user.passwordChangedAt,
      };
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordChangedAt: new Date() },
      select: { passwordChangedAt: true },
    });

    if (!updated.passwordChangedAt) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      ...user,
      passwordChangedAt: updated.passwordChangedAt,
    };
  }

  private async createRefreshTokenMaterial(): Promise<RefreshTokenMaterial> {
    const familyId = randomUUID();
    const tokenId = randomUUID();
    const rawSecret = createOpaqueRefreshSecret();
    const tokenHash = await bcrypt.hash(rawSecret, REFRESH_TOKEN_SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    return {
      familyId,
      tokenId,
      rawSecret,
      tokenHash,
      expiresAt,
    };
  }

  private async createRefreshTokenInTransaction(
    tx: Prisma.TransactionClient,
    user: AuthenticatedAuthUser,
    token: RefreshTokenMaterial,
  ): Promise<void> {
    await tx.refreshTokenFamily.create({
      data: {
        id: token.familyId,
        userId: user.id,
      },
      select: { id: true },
    });

    await tx.refreshToken.create({
      data: {
        id: token.tokenId,
        userId: user.id,
        tokenHash: token.tokenHash,
        familyId: token.familyId,
        expiresAt: token.expiresAt,
      },
      select: { id: true },
    });
  }

  private async rotateRefreshToken(
    user: AuthenticatedAuthUser,
    existingToken: RefreshTokenRecord,
  ): Promise<string> {
    const now = new Date();

    const replacementToken = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await this.lockUserAuthSessions(tx, user.id);
        await this.lockRefreshTokenFamily(tx, existingToken.familyId);

        const family = await tx.refreshTokenFamily.findUnique({
          where: { id: existingToken.familyId },
          select: {
            id: true,
            userId: true,
            compromisedAt: true,
            invalidatedAt: true,
          },
        });

        if (!family || family.userId !== user.id || family.compromisedAt || family.invalidatedAt) {
          return { status: 'invalid' } satisfies RotationResult;
        }

        const revokedToken = await tx.refreshToken.updateMany({
          where: {
            id: existingToken.id,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
            revocationReason: TokenRevocationReason.ROTATED,
          },
        });

        if (revokedToken.count !== 1) {
          await this.compromiseRefreshTokenFamilyInTransaction(tx, existingToken.familyId, now);

          return { status: 'replay' } satisfies RotationResult;
        }

        const tokenId = randomUUID();
        const rawSecret = createOpaqueRefreshSecret();
        const tokenHash = await bcrypt.hash(rawSecret, REFRESH_TOKEN_SALT_ROUNDS);

        const replacement = await tx.refreshToken.create({
          data: {
            id: tokenId,
            userId: user.id,
            tokenHash,
            familyId: existingToken.familyId,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
          },
          select: { id: true },
        });

        await tx.refreshToken.update({
          where: { id: existingToken.id },
          data: {
            replacedByTokenId: replacement.id,
          },
          select: { id: true },
        });

        return {
          status: 'rotated',
          refreshToken: this.serializeRefreshTokenCookieValue(replacement.id, rawSecret),
        } satisfies RotationResult;
      },
    );

    if (replacementToken.status === 'replay') {
      this.recordRefreshReplayDetected(user.id, existingToken.familyId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (replacementToken.status === 'invalid') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return replacementToken.refreshToken;
  }

  private async findStoredRefreshToken(
    userId: string,
    refreshTokenCookieValue: string,
  ): Promise<RefreshTokenRecord | null> {
    const token = await this.findStoredRefreshTokenByCookieValue(refreshTokenCookieValue);

    if (!token || token.userId !== userId) {
      return null;
    }

    return token;
  }

  private async findStoredRefreshTokenByCookieValue(
    refreshTokenCookieValue: string,
  ): Promise<RefreshTokenRecord | null> {
    const parsedToken = parseRefreshTokenCookieValue(refreshTokenCookieValue);

    if (!parsedToken) {
      return null;
    }

    const token = await this.prisma.refreshToken.findUnique({
      where: { id: parsedToken.tokenId },
      select: {
        id: true,
        userId: true,
        tokenHash: true,
        familyId: true,
        revokedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    if (!token) {
      return null;
    }

    const tokenMatches = await bcrypt.compare(parsedToken.rawSecret, token.tokenHash);

    if (!tokenMatches) {
      return null;
    }

    return token;
  }

  private async compromiseRefreshTokenFamily(familyId: string): Promise<void> {
    const now = new Date();

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.lockRefreshTokenFamily(tx, familyId);
      await this.compromiseRefreshTokenFamilyInTransaction(tx, familyId, now);
    });
  }

  private async invalidateActiveRefreshTokenFamiliesForUserInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    invalidatedAt: Date,
  ): Promise<void> {
    const activeFamilies = await tx.refreshTokenFamily.findMany({
      where: {
        userId,
        compromisedAt: null,
        invalidatedAt: null,
        refreshTokens: {
          some: {
            revokedAt: null,
          },
        },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    if (activeFamilies.length === 0) {
      return;
    }

    for (const family of activeFamilies) {
      await this.lockRefreshTokenFamily(tx, family.id);
    }

    const familyIds = activeFamilies.map((family) => family.id);

    await tx.refreshTokenFamily.updateMany({
      where: {
        id: { in: familyIds },
        invalidatedAt: null,
      },
      data: {
        invalidatedAt,
      },
    });

    await tx.refreshToken.updateMany({
      where: {
        userId,
        familyId: { in: familyIds },
        revokedAt: null,
      },
      data: {
        revokedAt: invalidatedAt,
        revocationReason: TokenRevocationReason.LOGOUT,
      },
    });
  }

  private async lockRefreshTokenFamily(
    tx: Prisma.TransactionClient,
    familyId: string,
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${familyId}, 0))`;
  }

  private async lockUserAuthSessions(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 1))`;
  }

  private async waitForForgotPasswordTimingFloor(startedAt: number): Promise<void> {
    const elapsedMs = Date.now() - startedAt;
    const remainingMs = FORGOT_PASSWORD_MIN_RESPONSE_MS - elapsedMs;

    if (remainingMs > 0) {
      await sleep(remainingMs);
    }
  }

  private async compromiseRefreshTokenFamilyInTransaction(
    tx: Prisma.TransactionClient,
    familyId: string,
    compromisedAt: Date,
  ): Promise<void> {
    await tx.refreshTokenFamily.updateMany({
      where: {
        id: familyId,
        compromisedAt: null,
      },
      data: {
        compromisedAt,
      },
    });

    await tx.refreshToken.updateMany({
      where: {
        familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: compromisedAt,
        revocationReason: TokenRevocationReason.COMPROMISED,
      },
    });
  }

  private serializeRefreshTokenCookieValue(tokenId: string, rawSecret: string): string {
    return `${tokenId}.${rawSecret}`;
  }

  private recordRefreshReplayDetected(userId: string, familyId: string): void {
    void userId;
    void familyId;
    // Internal hook reserved for future user alerting once notifications exist.
  }

  private buildTokenPayload(user: TokenReadyAuthUser): Required<JwtPayload> {
    return {
      sub: user.id,
      pwChangedAt: passwordChangedAtClaim(user.passwordChangedAt),
      platformRole: user.platformRole,
    };
  }

  private getAccessTokenSecret(): string {
    return getJwtAccessSecret();
  }

  private assertPasswordWithinBcryptLimit(password: string): void {
    if (!isBcryptPasswordInputLengthValid(password)) {
      throw new BadRequestException('password must be at most 72 UTF-8 bytes');
    }
  }

  private safeUserSelect() {
    return {
      id: true,
      email: true,
      name: true,
      platformRole: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.UserSelect;
  }
}
