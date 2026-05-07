import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AuthAuditEventType, AuthAuditOutcome, Prisma, PrismaClient } from '@prisma/client';

export type AuthAuditContext = {
  ipAddress?: string;
  userAgent?: string;
};

export type AuthAuditMetadataValue =
  | string
  | number
  | boolean
  | AuthAuditMetadataValue[]
  | { [key: string]: AuthAuditMetadataValue | undefined };

export type AuthAuditEvent = AuthAuditContext & {
  userId?: string;
  email?: string;
  eventType: AuthAuditEventType;
  outcome: AuthAuditOutcome;
  metadata?: Record<string, AuthAuditMetadataValue | undefined>;
};

const MAX_METADATA_KEYS = 20;
const MAX_METADATA_KEY_LENGTH = 64;
const MAX_METADATA_STRING_LENGTH = 160;
const MAX_METADATA_DEPTH = 4;
const MAX_METADATA_ARRAY_ITEMS = 20;
const MAX_CONTEXT_STRING_LENGTH = 512;
const REDACTED_METADATA_VALUE = '[REDACTED]';
const PROHIBITED_METADATA_KEYS = new Set([
  'password',
  'passwordhash',
  'accesstoken',
  'refreshtoken',
  'resettoken',
  'token',
  'tokenhash',
  'providertoken',
  'accesstoken',
  'refreshtoken',
  'totpsecret',
  'twofactorsecret',
  'backupcode',
  'backupcodes',
  'oauthstate',
  'state',
  'nonce',
  'challengetoken',
  'secret',
  'clientsecret',
]);
const PROHIBITED_METADATA_KEY_SUBSTRINGS = ['token', 'secret', 'password', 'nonce'] as const;

function normalizeOptionalString(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value?.trim();

  if (!normalized) {
    return undefined;
  }

  return normalized.slice(0, maxLength);
}

function normalizeEmail(email: string | undefined): string | undefined {
  return normalizeOptionalString(email, MAX_CONTEXT_STRING_LENGTH)?.toLowerCase();
}

function normalizeMetadataKeyForRedaction(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function shouldRedactMetadataKey(key: string): boolean {
  const normalizedKey = normalizeMetadataKeyForRedaction(key);

  return (
    PROHIBITED_METADATA_KEYS.has(normalizedKey) ||
    PROHIBITED_METADATA_KEY_SUBSTRINGS.some((substring) => normalizedKey.includes(substring))
  );
}

@Injectable()
export class AuthAuditService implements OnModuleDestroy {
  private readonly prisma = new PrismaClient();

  async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async audit(event: AuthAuditEvent): Promise<void> {
    try {
      const metadata = this.sanitizeMetadata(event.metadata);

      await this.prisma.authAuditLog.create({
        data: {
          userId: normalizeOptionalString(event.userId, MAX_CONTEXT_STRING_LENGTH),
          email: normalizeEmail(event.email),
          eventType: event.eventType,
          outcome: event.outcome,
          ipAddress: normalizeOptionalString(event.ipAddress, MAX_CONTEXT_STRING_LENGTH),
          userAgent: normalizeOptionalString(event.userAgent, MAX_CONTEXT_STRING_LENGTH),
          ...(metadata ? { metadata } : {}),
        },
        select: { id: true },
      });
    } catch (error: unknown) {
      void error;
    }
  }

  private sanitizeMetadata(
    metadata: Record<string, AuthAuditMetadataValue | undefined> | undefined,
  ): Prisma.InputJsonObject | undefined {
    if (!metadata) {
      return undefined;
    }

    const sanitized = this.sanitizeMetadataObject(metadata, 0);

    return sanitized && Object.keys(sanitized).length > 0
      ? (sanitized as Prisma.InputJsonObject)
      : undefined;
  }

  private sanitizeMetadataObject(
    metadata: Record<string, AuthAuditMetadataValue | undefined>,
    depth: number,
  ): Record<string, Prisma.InputJsonValue> | undefined {
    if (depth > MAX_METADATA_DEPTH) {
      return undefined;
    }

    const sanitized: Record<string, Prisma.InputJsonValue> = {};

    for (const [rawKey, rawValue] of Object.entries(metadata).slice(0, MAX_METADATA_KEYS)) {
      const key = rawKey.trim().slice(0, MAX_METADATA_KEY_LENGTH);

      if (!key || rawValue === undefined || rawValue === null) {
        continue;
      }

      if (shouldRedactMetadataKey(key)) {
        sanitized[key] = REDACTED_METADATA_VALUE;
        continue;
      }

      const value = this.sanitizeMetadataValue(rawValue, depth + 1);

      if (value !== undefined) {
        sanitized[key] = value;
      }
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  private sanitizeMetadataValue(
    rawValue: AuthAuditMetadataValue,
    depth: number,
  ): Prisma.InputJsonValue | undefined {
    if (depth > MAX_METADATA_DEPTH) {
      return undefined;
    }

    if (typeof rawValue === 'string') {
      const value = rawValue.trim();

      if (value) {
        return value.slice(0, MAX_METADATA_STRING_LENGTH);
      }

      return undefined;
    }

    if (typeof rawValue === 'number') {
      if (Number.isFinite(rawValue)) {
        return rawValue;
      }

      return undefined;
    }

    if (typeof rawValue === 'boolean') {
      return rawValue;
    }

    if (Array.isArray(rawValue)) {
      const sanitizedArray = rawValue
        .slice(0, MAX_METADATA_ARRAY_ITEMS)
        .map((item) => this.sanitizeMetadataValue(item, depth + 1))
        .filter((item): item is Prisma.InputJsonValue => item !== undefined);

      return sanitizedArray.length > 0 ? sanitizedArray : undefined;
    }

    const sanitizedObject = this.sanitizeMetadataObject(rawValue, depth + 1);

    return sanitizedObject ? (sanitizedObject as Prisma.InputJsonObject) : undefined;
  }
}
