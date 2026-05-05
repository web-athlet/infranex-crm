import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
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
import { createHash, randomBytes, randomUUID } from 'crypto';
import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';

import { getJwtAccessSecret } from './auth.config';
import { CryptoService } from './crypto.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TwoFactorDisableDto } from './dto/two-factor-disable.dto';
import { TwoFactorGenerateDto } from './dto/two-factor-generate.dto';
import { TwoFactorValidateDto } from './dto/two-factor-validate.dto';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';
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
const TOTP_ISSUER = 'Infranex CRM';
const TOTP_DIGITS = 6;
const TOTP_STEP_SECONDS = 30;
const TOTP_WINDOW = 1;
const TWO_FACTOR_CHALLENGE_EXPIRES_IN = '5m';
const TWO_FACTOR_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const TWO_FACTOR_BACKUP_CODE_COUNT = 10;
const TWO_FACTOR_BACKUP_CODE_BYTES = 10;
const LEGACY_TWO_FACTOR_UPGRADE_BATCH_SIZE = 100;
const TWO_FACTOR_INVALID_MESSAGE = 'Invalid two-factor authentication code';

export const REFRESH_TOKEN_COOKIE_NAME = 'infranex_refresh_token';

type JwtPayload = {
  sub?: unknown;
  pwChangedAt?: unknown;
  platformRole?: unknown;
};

type TwoFactorChallengeJwtPayload = {
  sub?: unknown;
  pwChangedAt?: unknown;
  purpose?: unknown;
  nonce?: unknown;
};

type VerifiedTwoFactorChallengeJwtPayload = {
  sub: string;
  pwChangedAt: string;
  purpose: TwoFactorChallengePurpose;
  nonce: string;
};

type TwoFactorChallengePurpose = '2fa' | '2fa_setup';

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

export type CompletedLoginResult = AccessTokenResponse & {
  refreshToken: string;
  user: SafeUserPayload;
};

export type TwoFactorLoginChallengeResponse = {
  requiresTwoFactor: true;
  challengeToken: string;
};

export type TwoFactorSetupRequiredResponse = {
  requiresTwoFactorSetup: true;
  setupToken: string;
};

export type LoginResult =
  | CompletedLoginResult
  | TwoFactorLoginChallengeResponse
  | TwoFactorSetupRequiredResponse;

export type TwoFactorSetupResponse = {
  qrCode: string;
  manualEntryKey: string;
};

export type TwoFactorVerifyResponse = {
  success: true;
  backupCodes: string[];
};

export type TwoFactorValidateResult = AccessTokenResponse & {
  refreshToken: string;
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

type RefreshTokenFamilyCreateOptions = {
  secondFactorSatisfiedAt?: Date | null;
};

type TwoFactorUserState = SafeUserSource & {
  passwordChangedAt: Date | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  twoFactorSecretEncrypted: string | null;
  twoFactorBackupCodesHash: Prisma.JsonValue | null;
  deletedAt: Date | null;
};

type TwoFactorSetupIdentity = {
  user: AuthenticatedAuthUser;
  setupTokenPayload: VerifiedTwoFactorChallengeJwtPayload | null;
};

type SecondFactorVerificationResult =
  | {
      valid: true;
      remainingBackupCodeHashes: string[] | null;
    }
  | {
      valid: false;
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

function hashTwoFactorNonce(nonce: string): string {
  return createHash('sha256').update(nonce, 'utf8').digest('hex');
}

function normalizeBackupCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function createBackupCode(): string {
  const normalized = randomBytes(TWO_FACTOR_BACKUP_CODE_BYTES).toString('hex').toUpperCase();
  const chunks = normalized.match(/.{1,4}/g);

  return chunks?.join('-') ?? normalized;
}

function parseBackupCodeHashes(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function isTwoFactorChallengePayload(
  payload: unknown,
): payload is VerifiedTwoFactorChallengeJwtPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as TwoFactorChallengeJwtPayload;

  return (
    isString(candidate.sub) &&
    isString(candidate.pwChangedAt) &&
    (candidate.purpose === '2fa' || candidate.purpose === '2fa_setup') &&
    isString(candidate.nonce)
  );
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
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma = new PrismaClient();

  constructor(
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly cryptoService: CryptoService,
  ) {
    void this.cryptoService;
  }

  async onModuleInit(): Promise<void> {
    await this.upgradeLegacyTwoFactorSecrets();
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  private async upgradeLegacyTwoFactorSecrets(): Promise<void> {
    let hasLegacySecrets = true;

    while (hasLegacySecrets) {
      const users = await this.prisma.user.findMany({
        where: {
          twoFactorSecret: {
            not: null,
          },
        },
        select: { id: true },
        take: LEGACY_TWO_FACTOR_UPGRADE_BATCH_SIZE,
        orderBy: { id: 'asc' },
      });

      if (users.length === 0) {
        hasLegacySecrets = false;
        continue;
      }

      for (const user of users) {
        await this.upgradeLegacyTwoFactorSecret(user.id);
      }
    }
  }

  private async upgradeLegacyTwoFactorSecret(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.lockUserAuthSessions(tx, userId);

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          twoFactorSecret: true,
          twoFactorSecretEncrypted: true,
        },
      });

      if (!user?.twoFactorSecret) {
        return;
      }

      const data: Prisma.UserUpdateInput = user.twoFactorSecretEncrypted
        ? { twoFactorSecret: null }
        : {
            twoFactorSecret: null,
            twoFactorSecretEncrypted: this.cryptoService.encrypt(user.twoFactorSecret),
          };

      await tx.user.update({
        where: { id: user.id },
        data,
        select: { id: true },
      });
    });
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

    const loginSession = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.lockUserAuthSessions(tx, user.id);

      const lockedUser = await tx.user.findUnique({
        where: { id: user.id },
        select: {
          ...this.safeUserSelect(),
          passwordHash: true,
          passwordChangedAt: true,
          twoFactorEnabled: true,
          twoFactorSecret: true,
          twoFactorSecretEncrypted: true,
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

      if (lockedUser.twoFactorEnabled) {
        const encryptedSecret = await this.ensureEncryptedTwoFactorSecretInTransaction(
          tx,
          lockedUser,
        );

        if (!encryptedSecret) {
          throw new UnauthorizedException('Invalid email or password');
        }

        const nonce = await this.createTwoFactorChallengeInTransaction(tx, lockedUser.id, '2fa');

        return {
          status: 'twoFactorRequired' as const,
          authenticatedUser,
          nonce,
        };
      }

      if (lockedUser.platformRole === PlatformRole.PLATFORM_ADMIN) {
        const nonce = await this.createTwoFactorChallengeInTransaction(
          tx,
          lockedUser.id,
          '2fa_setup',
        );

        return {
          status: 'twoFactorSetupRequired' as const,
          authenticatedUser,
          nonce,
        };
      }

      const refreshTokenMaterial = await this.createRefreshTokenMaterial();
      await this.createRefreshTokenInTransaction(tx, authenticatedUser, refreshTokenMaterial);

      await tx.user.update({
        where: { id: lockedUser.id },
        data: { lastLoginAt: new Date() },
        select: { id: true },
      });

      return {
        status: 'completed' as const,
        authenticatedUser,
        refreshToken: this.serializeRefreshTokenCookieValue(
          refreshTokenMaterial.tokenId,
          refreshTokenMaterial.rawSecret,
        ),
      };
    });

    if (loginSession.status === 'twoFactorSetupRequired') {
      return {
        requiresTwoFactorSetup: true,
        setupToken: await this.signTwoFactorChallengeToken(
          loginSession.authenticatedUser,
          loginSession.nonce,
          '2fa_setup',
        ),
      };
    }

    if (loginSession.status === 'twoFactorRequired') {
      return {
        requiresTwoFactor: true,
        challengeToken: await this.signTwoFactorChallengeToken(
          loginSession.authenticatedUser,
          loginSession.nonce,
          '2fa',
        ),
      };
    }

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

  async generateTwoFactorSetup(
    authorizationHeader: string | undefined,
    dto: TwoFactorGenerateDto,
  ): Promise<TwoFactorSetupResponse> {
    const identity = await this.authenticateTwoFactorSetupIdentity(
      authorizationHeader,
      dto.setupToken,
    );
    const secret = generateSecret();
    const encryptedSecret = this.cryptoService.encrypt(secret);

    const lockedUser = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.lockUserAuthSessions(tx, identity.user.id);

      const currentUser = await tx.user.findUnique({
        where: { id: identity.user.id },
        select: {
          id: true,
          email: true,
          passwordChangedAt: true,
          twoFactorEnabled: true,
          deletedAt: true,
        },
      });

      if (!currentUser || currentUser.deletedAt) {
        throw new UnauthorizedException('Invalid token payload');
      }

      if (identity.setupTokenPayload) {
        if (
          !currentUser.passwordChangedAt ||
          identity.setupTokenPayload.pwChangedAt !==
            passwordChangedAtClaim(currentUser.passwordChangedAt)
        ) {
          throw new UnauthorizedException('Invalid token payload');
        }

        await this.assertTwoFactorChallengeActiveInTransaction(
          tx,
          identity.setupTokenPayload,
          '2fa_setup',
          new Date(),
        );
      }

      if (currentUser.twoFactorEnabled) {
        throw new BadRequestException('Two-factor authentication is already enabled');
      }

      await tx.user.update({
        where: { id: currentUser.id },
        data: {
          twoFactorSecret: null,
          twoFactorSecretEncrypted: encryptedSecret,
          twoFactorBackupCodesHash: Prisma.DbNull,
          twoFactorEnabled: false,
          twoFactorEnabledAt: null,
          twoFactorLastValidatedAt: null,
        },
        select: { id: true },
      });

      return currentUser;
    });

    const otpauthUrl = generateURI({
      issuer: TOTP_ISSUER,
      label: lockedUser.email,
      secret,
      digits: TOTP_DIGITS,
      period: TOTP_STEP_SECONDS,
    });
    const qrCode = await QRCode.toDataURL(otpauthUrl, { type: 'image/png' });

    return {
      qrCode,
      manualEntryKey: secret,
    };
  }

  async verifyTwoFactorSetup(
    authorizationHeader: string | undefined,
    dto: TwoFactorVerifyDto,
  ): Promise<TwoFactorVerifyResponse> {
    const identity = await this.authenticateTwoFactorSetupIdentity(
      authorizationHeader,
      dto.setupToken,
    );
    const now = new Date();
    const backupCodes = Array.from({ length: TWO_FACTOR_BACKUP_CODE_COUNT }, () =>
      createBackupCode(),
    );
    const backupCodeHashes = await this.hashBackupCodes(backupCodes);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.lockUserAuthSessions(tx, identity.user.id);

      const currentUser = await tx.user.findUnique({
        where: { id: identity.user.id },
        select: {
          id: true,
          passwordChangedAt: true,
          twoFactorEnabled: true,
          twoFactorSecretEncrypted: true,
          deletedAt: true,
        },
      });

      if (!currentUser || currentUser.deletedAt) {
        throw new UnauthorizedException('Invalid token payload');
      }

      if (
        identity.setupTokenPayload &&
        (!currentUser.passwordChangedAt ||
          identity.setupTokenPayload.pwChangedAt !==
            passwordChangedAtClaim(currentUser.passwordChangedAt))
      ) {
        throw new UnauthorizedException('Invalid token payload');
      }

      if (currentUser.twoFactorEnabled || !currentUser.twoFactorSecretEncrypted) {
        throw new BadRequestException('Two-factor authentication setup is not pending');
      }

      if (!(await this.verifyTotpCode(currentUser.twoFactorSecretEncrypted, dto.code))) {
        throw new UnauthorizedException(TWO_FACTOR_INVALID_MESSAGE);
      }

      await tx.user.update({
        where: { id: currentUser.id },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: null,
          twoFactorBackupCodesHash: backupCodeHashes,
          twoFactorEnabledAt: now,
          twoFactorLastValidatedAt: now,
          passwordChangedAt: now,
        },
        select: { id: true },
      });

      if (identity.setupTokenPayload) {
        await this.consumeTwoFactorChallengeInTransaction(
          tx,
          identity.setupTokenPayload,
          '2fa_setup',
          now,
        );
      }

      await this.invalidateActiveRefreshTokenFamiliesForUserInTransaction(tx, currentUser.id, now);
    });

    return {
      success: true,
      backupCodes,
    };
  }

  async validateTwoFactorLogin(dto: TwoFactorValidateDto): Promise<TwoFactorValidateResult> {
    const payload = await this.verifyTwoFactorChallengeToken(dto.challengeToken);
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.lockUserAuthSessions(tx, payload.sub);

      const user = await tx.user.findUnique({
        where: { id: payload.sub },
        select: this.twoFactorUserSelect(),
      });

      if (
        !user ||
        user.deletedAt ||
        !user.passwordChangedAt ||
        payload.pwChangedAt !== passwordChangedAtClaim(user.passwordChangedAt) ||
        !user.twoFactorEnabled
      ) {
        throw new UnauthorizedException(TWO_FACTOR_INVALID_MESSAGE);
      }

      await this.assertTwoFactorChallengeActiveInTransaction(tx, payload, '2fa', now);

      const encryptedSecret = await this.ensureEncryptedTwoFactorSecretInTransaction(tx, user);
      const secondFactor = await this.verifySecondFactor(
        { ...user, twoFactorSecretEncrypted: encryptedSecret },
        dto.code,
      );

      if (!secondFactor.valid) {
        throw new UnauthorizedException(TWO_FACTOR_INVALID_MESSAGE);
      }

      await this.consumeTwoFactorChallengeInTransaction(tx, payload, '2fa', now);

      await tx.user.update({
        where: { id: user.id },
        data: {
          twoFactorLastValidatedAt: now,
          lastLoginAt: now,
          ...(secondFactor.remainingBackupCodeHashes
            ? { twoFactorBackupCodesHash: secondFactor.remainingBackupCodeHashes }
            : {}),
        },
        select: { id: true },
      });

      const refreshTokenMaterial = await this.createRefreshTokenMaterial();
      const authenticatedUser: TokenReadyAuthUser = {
        ...this.toSafeUser(user),
        passwordChangedAt: user.passwordChangedAt,
      };
      await this.createRefreshTokenInTransaction(tx, authenticatedUser, refreshTokenMaterial, {
        secondFactorSatisfiedAt: now,
      });

      return {
        authenticatedUser,
        refreshToken: this.serializeRefreshTokenCookieValue(
          refreshTokenMaterial.tokenId,
          refreshTokenMaterial.rawSecret,
        ),
      };
    });

    return {
      accessToken: await this.signAccessToken(result.authenticatedUser),
      refreshToken: result.refreshToken,
    };
  }

  async disableTwoFactor(user: AuthenticatedAuthUser, dto: TwoFactorDisableDto): Promise<void> {
    if (!isBcryptPasswordInputLengthValid(dto.password)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.lockUserAuthSessions(tx, user.id);

      const currentUser = await tx.user.findUnique({
        where: { id: user.id },
        select: {
          ...this.twoFactorUserSelect(),
          passwordHash: true,
        },
      });

      if (!currentUser || currentUser.deletedAt || !currentUser.twoFactorEnabled) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const passwordMatches = await bcrypt.compare(dto.password, currentUser.passwordHash);

      if (!passwordMatches) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const encryptedSecret = await this.ensureEncryptedTwoFactorSecretInTransaction(
        tx,
        currentUser,
      );
      const secondFactor = await this.verifySecondFactor(
        { ...currentUser, twoFactorSecretEncrypted: encryptedSecret },
        dto.code,
      );

      if (!secondFactor.valid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      await tx.user.update({
        where: { id: currentUser.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorSecretEncrypted: null,
          twoFactorBackupCodesHash: Prisma.DbNull,
          twoFactorEnabledAt: null,
          twoFactorLastValidatedAt: null,
          passwordChangedAt: now,
        },
        select: { id: true },
      });

      await this.invalidateActiveRefreshTokenFamiliesForUserInTransaction(tx, currentUser.id, now);
    });
  }

  async refresh(
    user: AuthenticatedAuthUser,
    rawRefreshToken: string,
  ): Promise<CompletedLoginResult> {
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
        twoFactorEnabled: true,
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
        twoFactorEnabled: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt || !user.passwordChangedAt) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (payload.pwChangedAt !== passwordChangedAtClaim(user.passwordChangedAt)) {
      throw new UnauthorizedException('Invalid token payload');
    }

    if (this.isPlatformAdminMissingTwoFactor(user)) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      ...this.toSafeUser(user),
      passwordChangedAt: user.passwordChangedAt,
    };
  }

  private isPlatformAdminMissingTwoFactor(user: {
    platformRole: PlatformRole;
    twoFactorEnabled: boolean;
  }): boolean {
    return user.platformRole === PlatformRole.PLATFORM_ADMIN && !user.twoFactorEnabled;
  }

  private async signAccessToken(user: TokenReadyAuthUser): Promise<string> {
    return this.jwtService.signAsync(this.buildTokenPayload(user), {
      secret: this.getAccessTokenSecret(),
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });
  }

  private async signTwoFactorChallengeToken(
    user: TokenReadyAuthUser,
    nonce: string,
    purpose: TwoFactorChallengePurpose,
  ): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        pwChangedAt: passwordChangedAtClaim(user.passwordChangedAt),
        purpose,
        nonce,
      },
      {
        secret: this.getTwoFactorChallengeSecret(),
        expiresIn: TWO_FACTOR_CHALLENGE_EXPIRES_IN,
      },
    );
  }

  private async verifyTwoFactorChallengeToken(
    challengeToken: string,
  ): Promise<VerifiedTwoFactorChallengeJwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync<Record<string, unknown>>(challengeToken, {
        secret: this.getTwoFactorChallengeSecret(),
      });

      if (!isTwoFactorChallengePayload(payload)) {
        throw new UnauthorizedException(TWO_FACTOR_INVALID_MESSAGE);
      }

      return payload;
    } catch {
      throw new UnauthorizedException(TWO_FACTOR_INVALID_MESSAGE);
    }
  }

  private async authenticateTwoFactorSetupIdentity(
    authorizationHeader: string | undefined,
    setupToken: string | undefined,
  ): Promise<TwoFactorSetupIdentity> {
    if (setupToken) {
      const payload = await this.verifyTwoFactorChallengeToken(setupToken);

      if (payload.purpose !== '2fa_setup') {
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

      if (
        !user ||
        user.deletedAt ||
        !user.passwordChangedAt ||
        payload.pwChangedAt !== passwordChangedAtClaim(user.passwordChangedAt)
      ) {
        throw new UnauthorizedException('Invalid token payload');
      }

      return {
        user: {
          ...this.toSafeUser(user),
          passwordChangedAt: user.passwordChangedAt,
        },
        setupTokenPayload: payload,
      };
    }

    const bearerToken = this.getBearerToken(authorizationHeader);

    if (!bearerToken) {
      throw new UnauthorizedException('Missing authenticated user');
    }

    let payload: Record<string, unknown>;

    try {
      payload = await this.jwtService.verifyAsync<Record<string, unknown>>(bearerToken, {
        secret: this.getAccessTokenSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid token payload');
    }

    return {
      user: await this.validateAccessPayload(payload),
      setupTokenPayload: null,
    };
  }

  private getBearerToken(authorizationHeader: string | undefined): string | null {
    if (!authorizationHeader) {
      return null;
    }

    const [scheme, token] = authorizationHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
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

  private async hashBackupCodes(backupCodes: string[]): Promise<string[]> {
    return Promise.all(
      backupCodes.map((backupCode) =>
        bcrypt.hash(normalizeBackupCode(backupCode), REFRESH_TOKEN_SALT_ROUNDS),
      ),
    );
  }

  private async verifyTotpCode(encryptedSecret: string, code: string): Promise<boolean> {
    try {
      const secret = this.cryptoService.decrypt(encryptedSecret);
      const normalizedCode = code.trim().replace(/\s/g, '');
      const result = await verify({
        secret,
        token: normalizedCode,
        digits: TOTP_DIGITS,
        period: TOTP_STEP_SECONDS,
        epochTolerance: TOTP_WINDOW * TOTP_STEP_SECONDS,
      });

      return result.valid;
    } catch {
      return false;
    }
  }

  private async verifySecondFactor(
    user: TwoFactorUserState,
    code: string,
  ): Promise<SecondFactorVerificationResult> {
    if (!user.twoFactorSecretEncrypted) {
      return { valid: false };
    }

    if (await this.verifyTotpCode(user.twoFactorSecretEncrypted, code)) {
      return {
        valid: true,
        remainingBackupCodeHashes: null,
      };
    }

    const normalizedBackupCode = normalizeBackupCode(code);

    if (!normalizedBackupCode) {
      return { valid: false };
    }

    const backupCodeHashes = parseBackupCodeHashes(user.twoFactorBackupCodesHash);

    for (const [index, backupCodeHash] of backupCodeHashes.entries()) {
      const backupCodeMatches = await bcrypt.compare(normalizedBackupCode, backupCodeHash);

      if (backupCodeMatches) {
        return {
          valid: true,
          remainingBackupCodeHashes: backupCodeHashes.filter((_, itemIndex) => itemIndex !== index),
        };
      }
    }

    return { valid: false };
  }

  private async ensureEncryptedTwoFactorSecretInTransaction(
    tx: Prisma.TransactionClient,
    user: {
      id: string;
      twoFactorSecret: string | null;
      twoFactorSecretEncrypted: string | null;
    },
  ): Promise<string | null> {
    if (user.twoFactorSecretEncrypted) {
      if (user.twoFactorSecret) {
        await tx.user.update({
          where: { id: user.id },
          data: { twoFactorSecret: null },
          select: { id: true },
        });
      }

      return user.twoFactorSecretEncrypted;
    }

    if (!user.twoFactorSecret) {
      return null;
    }

    const encryptedSecret = this.cryptoService.encrypt(user.twoFactorSecret);

    await tx.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecretEncrypted: encryptedSecret,
        twoFactorSecret: null,
      },
      select: { id: true },
    });

    return encryptedSecret;
  }

  private async createRefreshTokenInTransaction(
    tx: Prisma.TransactionClient,
    user: AuthenticatedAuthUser,
    token: RefreshTokenMaterial,
    options: RefreshTokenFamilyCreateOptions = {},
  ): Promise<void> {
    await tx.refreshTokenFamily.create({
      data: {
        id: token.familyId,
        userId: user.id,
        secondFactorSatisfiedAt: options.secondFactorSatisfiedAt ?? null,
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

  private async createTwoFactorChallengeInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    purpose: TwoFactorChallengePurpose,
  ): Promise<string> {
    const nonce = randomBytes(32).toString('base64url');

    await tx.twoFactorChallenge.create({
      data: {
        userId,
        purpose,
        nonceHash: hashTwoFactorNonce(nonce),
        expiresAt: new Date(Date.now() + TWO_FACTOR_CHALLENGE_TTL_MS),
      },
      select: { id: true },
    });

    return nonce;
  }

  private async assertTwoFactorChallengeActiveInTransaction(
    tx: Prisma.TransactionClient,
    payload: VerifiedTwoFactorChallengeJwtPayload,
    purpose: TwoFactorChallengePurpose,
    now: Date,
  ): Promise<void> {
    const challenge = await tx.twoFactorChallenge.findFirst({
      where: {
        userId: payload.sub,
        purpose,
        nonceHash: hashTwoFactorNonce(payload.nonce),
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      select: { id: true },
    });

    if (!challenge) {
      throw new UnauthorizedException(TWO_FACTOR_INVALID_MESSAGE);
    }
  }

  private async consumeTwoFactorChallengeInTransaction(
    tx: Prisma.TransactionClient,
    payload: VerifiedTwoFactorChallengeJwtPayload,
    purpose: TwoFactorChallengePurpose,
    now: Date,
  ): Promise<void> {
    const usedChallenge = await tx.twoFactorChallenge.updateMany({
      where: {
        userId: payload.sub,
        purpose,
        nonceHash: hashTwoFactorNonce(payload.nonce),
        usedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: { usedAt: now },
    });

    if (usedChallenge.count !== 1) {
      throw new UnauthorizedException(TWO_FACTOR_INVALID_MESSAGE);
    }
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
            secondFactorSatisfiedAt: true,
          },
        });

        if (!family || family.userId !== user.id || family.compromisedAt || family.invalidatedAt) {
          return { status: 'invalid' } satisfies RotationResult;
        }

        const currentUser = await tx.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            platformRole: true,
            twoFactorEnabled: true,
            deletedAt: true,
          },
        });

        if (!currentUser || currentUser.deletedAt) {
          await this.invalidateRefreshTokenFamilyInTransaction(tx, family.id, now);

          return { status: 'invalid' } satisfies RotationResult;
        }

        if (
          this.isPlatformAdminMissingTwoFactor(currentUser) ||
          (currentUser.twoFactorEnabled && !family.secondFactorSatisfiedAt)
        ) {
          await this.invalidateRefreshTokenFamilyInTransaction(tx, family.id, now);

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

  private async invalidateRefreshTokenFamilyInTransaction(
    tx: Prisma.TransactionClient,
    familyId: string,
    invalidatedAt: Date,
  ): Promise<void> {
    await tx.refreshTokenFamily.updateMany({
      where: {
        id: familyId,
        invalidatedAt: null,
      },
      data: {
        invalidatedAt,
      },
    });

    await tx.refreshToken.updateMany({
      where: {
        familyId,
        revokedAt: null,
      },
      data: {
        revokedAt: invalidatedAt,
        revocationReason: TokenRevocationReason.LOGOUT,
      },
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

  private getTwoFactorChallengeSecret(): string {
    return `${this.getAccessTokenSecret()}:two-factor-challenge`;
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

  private twoFactorUserSelect() {
    return {
      ...this.safeUserSelect(),
      passwordChangedAt: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorSecretEncrypted: true,
      twoFactorBackupCodesHash: true,
      deletedAt: true,
    } satisfies Prisma.UserSelect;
  }
}
