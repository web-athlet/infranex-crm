import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { ForbiddenException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from './tenant-context.service';

type MembershipResult = {
  id: string;
  tenantId: string;
  role: 'OWNER';
} | null;

class TenantPrismaMock {
  membershipFindFirstArgs: unknown;
  membershipResult: MembershipResult = {
    id: 'membership-a',
    tenantId: 'tenant-a',
    role: 'OWNER',
  };

  membership = {
    findFirst: async (args: unknown): Promise<MembershipResult> => {
      this.membershipFindFirstArgs = args;
      return this.membershipResult;
    },
  };
}

function record(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, 'object');
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);

  return value as Record<string, unknown>;
}

test('TenantContextService resolves the first active membership deterministically', async () => {
  const prisma = new TenantPrismaMock();
  const service = new TenantContextService(prisma as unknown as PrismaService);

  const context = await service.resolveForUser('user-a');
  const args = record(prisma.membershipFindFirstArgs);
  const where = record(args.where);

  assert.deepEqual(context, {
    tenantId: 'tenant-a',
    membershipId: 'membership-a',
    role: 'OWNER',
  });
  assert.equal(where.userId, 'user-a');
  assert.equal(where.isActive, true);
  assert.equal(where.deletedAt, null);
  assert.deepEqual(args.orderBy, [{ createdAt: 'asc' }, { id: 'asc' }]);
});

test('TenantContextService rejects users without active tenant membership', async () => {
  const prisma = new TenantPrismaMock();
  prisma.membershipResult = null;
  const service = new TenantContextService(prisma as unknown as PrismaService);

  await assert.rejects(() => service.resolveForUser('user-a'), ForbiddenException);
});
