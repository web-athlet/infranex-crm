import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { Prisma } from '@prisma/client';

import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TenantContextService } from '../../shared/tenant/tenant-context.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsModule } from './organizations.module';
import { OrganizationsService } from './organizations.service';

const organizationRow = {
  id: 'org-a',
  name: 'Acme',
  website: null,
  domain: 'acme.test',
  industry: null,
  notes: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  _count: { people: 0 },
};

class OrganizationsPrismaMock {
  organizationCountArgs: unknown;
  organizationFindManyArgs: unknown;
  organizationFindFirstArgs: unknown;
  organizationCreateArgs: unknown;
  organizationUpdateManyArgs: unknown;
  organizationUpdateArgs: unknown;
  personUpdateManyArgs: unknown;
  createError: unknown;
  updateManyCount = 1;

  organization = {
    count: async (args: unknown): Promise<number> => {
      this.organizationCountArgs = args;
      return 1;
    },
    findMany: async (args: unknown): Promise<unknown[]> => {
      this.organizationFindManyArgs = args;
      return [organizationRow];
    },
    findFirst: async (args: unknown): Promise<unknown> => {
      this.organizationFindFirstArgs = args;
      return { id: 'org-a', domain: organizationRow.domain };
    },
    create: async (args: unknown): Promise<unknown> => {
      this.organizationCreateArgs = args;
      if (this.createError) {
        throw this.createError;
      }
      return organizationRow;
    },
    updateMany: async (args: unknown): Promise<{ count: number }> => {
      this.organizationUpdateManyArgs = args;
      return { count: this.updateManyCount };
    },
    update: async (args: unknown): Promise<unknown> => {
      this.organizationUpdateArgs = args;
      return organizationRow;
    },
  };

  person = {
    updateMany: async (args: unknown): Promise<{ count: number }> => {
      this.personUpdateManyArgs = args;
      return { count: 2 };
    },
  };

  async $transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return callback(this as unknown as Prisma.TransactionClient);
  }
}

class WritableTenantContextMock {
  resolveForUser = async () => ({
    tenantId: 'tenant-a',
    membershipId: 'membership-a',
    role: 'OWNER' as const,
  });

  assertCanWrite(): void {}
}

class ReadOnlyTenantContextMock extends WritableTenantContextMock {
  override assertCanWrite(): void {
    throw new ForbiddenException('Tenant write role is required');
  }
}

function record(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, 'object');
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);

  return value as Record<string, unknown>;
}

function assertSelectCountsActivePeople(args: unknown): void {
  const select = record(record(record(args).select)._count);
  const people = record(record(select.select).people);

  assert.deepEqual(people.where, {
    deletedAt: null,
  });
}

function service(
  prisma: OrganizationsPrismaMock,
  tenantContext: WritableTenantContextMock = new WritableTenantContextMock(),
) {
  return new OrganizationsService(
    prisma as unknown as PrismaService,
    tenantContext as unknown as TenantContextService,
  );
}

test('OrganizationsController requires JwtAuthGuard and rejects missing user', async () => {
  const controller = new OrganizationsController(
    service(new OrganizationsPrismaMock()) as unknown as OrganizationsService,
  );
  const guards = Reflect.getMetadata(GUARDS_METADATA, OrganizationsController) as unknown[];

  assert.ok(guards.includes(JwtAuthGuard));
  assert.throws(() => controller.list(undefined, {}), UnauthorizedException);
});

test('OrganizationsModule imports PrismaModule for direct PrismaService injection', () => {
  const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, OrganizationsModule) as unknown[];

  assert.ok(imports.includes(PrismaModule));
});

test('OrganizationsService scopes list queries to tenant and caps pagination', async () => {
  const prisma = new OrganizationsPrismaMock();
  await service(prisma).list('user-a', { page: 1, limit: 100, search: 'acme' });
  const findManyArgs = record(prisma.organizationFindManyArgs);
  const where = record(findManyArgs.where);

  assert.equal(where.tenantId, 'tenant-a');
  assert.equal(where.deletedAt, null);
  assert.equal(findManyArgs.take, 100);
  assert.equal(findManyArgs.skip, 0);
});

test('OrganizationsService counts only active people in list and detail responses', async () => {
  const prisma = new OrganizationsPrismaMock();
  const organizationsService = service(prisma);

  await organizationsService.list('user-a', {});
  assertSelectCountsActivePeople(prisma.organizationFindManyArgs);

  await organizationsService.get('user-a', 'org-a');
  assertSelectCountsActivePeople(prisma.organizationFindFirstArgs);
});

test('OrganizationsService creates, updates and soft-deletes organizations tenant-scoped', async () => {
  const prisma = new OrganizationsPrismaMock();
  const organizationsService = service(prisma);

  await organizationsService.create('user-a', { name: ' Acme ', domain: 'ACME.TEST' });
  assert.equal(record(record(prisma.organizationCreateArgs).data).tenantId, 'tenant-a');
  assert.equal(record(record(prisma.organizationCreateArgs).data).domain, 'acme.test');

  await organizationsService.update('user-a', 'org-a', { name: 'Acme GmbH' });
  assert.deepEqual(record(prisma.organizationUpdateManyArgs).where, {
    id: 'org-a',
    tenantId: 'tenant-a',
    deletedAt: null,
  });

  await organizationsService.remove('user-a', 'org-a');
  assert.deepEqual(record(prisma.personUpdateManyArgs).where, {
    tenantId: 'tenant-a',
    organizationId: 'org-a',
    deletedAt: null,
  });
  assert.deepEqual(record(prisma.personUpdateManyArgs).data, {
    organizationId: null,
  });
  const deleteData = record(record(prisma.organizationUpdateArgs).data);
  assert.ok(deleteData.deletedAt instanceof Date);
  assert.equal(deleteData.domain, null);
});

test('OrganizationsService does not patch soft-deleted organizations', async () => {
  const prisma = new OrganizationsPrismaMock();
  prisma.updateManyCount = 0;

  await assert.rejects(
    () => service(prisma).update('user-a', 'org-a', { domain: 'acme.test' }),
    NotFoundException,
  );
  assert.deepEqual(record(prisma.organizationUpdateManyArgs).where, {
    id: 'org-a',
    tenantId: 'tenant-a',
    deletedAt: null,
  });
});

test('OrganizationsService maps tenant domain conflicts', async () => {
  const prisma = new OrganizationsPrismaMock();
  prisma.createError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

  await assert.rejects(
    () => service(prisma).create('user-a', { name: 'Acme', domain: 'acme.test' }),
    ConflictException,
  );
});

test('OrganizationsService blocks writes for read-only memberships', async () => {
  const prisma = new OrganizationsPrismaMock();

  await assert.rejects(
    () => service(prisma, new ReadOnlyTenantContextMock()).create('user-a', { name: 'Acme' }),
    ForbiddenException,
  );
});
