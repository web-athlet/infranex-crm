import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { Prisma } from '@prisma/client';

import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TenantContextService } from '../../shared/tenant/tenant-context.service';
import { ContactsController } from './contacts.controller';
import { ContactsModule } from './contacts.module';
import { ContactsService } from './contacts.service';

const contactRow = {
  id: 'contact-a',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.test',
  phone: null,
  title: null,
  notes: null,
  optIn: false,
  organizationId: 'org-a',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  organization: { id: 'org-a', name: 'Acme', domain: 'acme.test' },
};

class ContactsPrismaMock {
  personCountArgs: unknown;
  personFindManyArgs: unknown;
  personFindFirstArgs: unknown;
  personCreateArgs: unknown;
  personUpdateManyArgs: unknown;
  personUpdateArgs: unknown;
  organizationFindFirstArgs: unknown;
  createError: unknown;
  updateManyCount = 1;
  organizationExists = true;

  person = {
    count: async (args: unknown): Promise<number> => {
      this.personCountArgs = args;
      return 1;
    },
    findMany: async (args: unknown): Promise<unknown[]> => {
      this.personFindManyArgs = args;
      return [contactRow];
    },
    findFirst: async (args: unknown): Promise<unknown> => {
      this.personFindFirstArgs = args;
      return { id: 'contact-a', email: contactRow.email };
    },
    create: async (args: unknown): Promise<unknown> => {
      this.personCreateArgs = args;
      if (this.createError) {
        throw this.createError;
      }
      return contactRow;
    },
    updateMany: async (args: unknown): Promise<{ count: number }> => {
      this.personUpdateManyArgs = args;
      return { count: this.updateManyCount };
    },
    update: async (args: unknown): Promise<unknown> => {
      this.personUpdateArgs = args;
      return contactRow;
    },
  };

  organization = {
    findFirst: async (args: unknown): Promise<unknown> => {
      this.organizationFindFirstArgs = args;
      return this.organizationExists ? { id: 'org-a' } : null;
    },
  };

  async $transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return callback(this as unknown as Prisma.TransactionClient);
  }
}

class TenantContextMock {
  resolveForUser = async () => ({
    tenantId: 'tenant-a',
    membershipId: 'membership-a',
    role: 'OWNER' as const,
  });

  assertCanWrite(): void {}
}

function record(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, 'object');
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);

  return value as Record<string, unknown>;
}

function service(prisma: ContactsPrismaMock) {
  return new ContactsService(
    prisma as unknown as PrismaService,
    new TenantContextMock() as unknown as TenantContextService,
  );
}

test('ContactsController requires JwtAuthGuard and rejects missing user', async () => {
  const controller = new ContactsController(service(new ContactsPrismaMock()));
  const guards = Reflect.getMetadata(GUARDS_METADATA, ContactsController) as unknown[];

  assert.ok(guards.includes(JwtAuthGuard));
  assert.throws(() => controller.list(undefined, {}), UnauthorizedException);
});

test('ContactsModule imports PrismaModule for direct PrismaService injection', () => {
  const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, ContactsModule) as unknown[];

  assert.ok(imports.includes(PrismaModule));
});

test('ContactsService scopes list queries to tenant and caps pagination', async () => {
  const prisma = new ContactsPrismaMock();
  await service(prisma).list('user-a', { page: 1, limit: 100, search: 'ada' });
  const findManyArgs = record(prisma.personFindManyArgs);
  const where = record(findManyArgs.where);

  assert.equal(where.tenantId, 'tenant-a');
  assert.equal(where.deletedAt, null);
  assert.equal(findManyArgs.take, 100);
  assert.equal(findManyArgs.skip, 0);
});

test('ContactsService creates, updates and soft-deletes contacts tenant-scoped', async () => {
  const prisma = new ContactsPrismaMock();
  const contactsService = service(prisma);

  await contactsService.create('user-a', {
    firstName: ' Ada ',
    lastName: ' Lovelace ',
    email: 'ADA@EXAMPLE.TEST',
    organizationId: 'org-a',
  });
  assert.equal(record(record(prisma.personCreateArgs).data).tenantId, 'tenant-a');
  assert.equal(record(record(prisma.personCreateArgs).data).email, 'ada@example.test');
  assert.equal(record(record(prisma.organizationFindFirstArgs).where).tenantId, 'tenant-a');

  await contactsService.update('user-a', 'contact-a', { lastName: 'Byron' });
  assert.deepEqual(record(prisma.personUpdateManyArgs).where, {
    id: 'contact-a',
    tenantId: 'tenant-a',
    deletedAt: null,
  });

  await contactsService.remove('user-a', 'contact-a');
  const deleteData = record(record(prisma.personUpdateArgs).data);
  assert.ok(deleteData.deletedAt instanceof Date);
  assert.equal(deleteData.email, null);
});

test('ContactsService rejects organization links outside the resolved tenant', async () => {
  const prisma = new ContactsPrismaMock();
  prisma.organizationExists = false;

  await assert.rejects(
    () =>
      service(prisma).create('user-a', {
        firstName: 'Ada',
        lastName: 'Lovelace',
        organizationId: 'org-other',
      }),
    NotFoundException,
  );
});

test('ContactsService does not patch soft-deleted contacts', async () => {
  const prisma = new ContactsPrismaMock();
  prisma.updateManyCount = 0;

  await assert.rejects(
    () => service(prisma).update('user-a', 'contact-a', { email: 'ada@example.test' }),
    NotFoundException,
  );
  assert.deepEqual(record(prisma.personUpdateManyArgs).where, {
    id: 'contact-a',
    tenantId: 'tenant-a',
    deletedAt: null,
  });
});

test('ContactsService maps tenant email conflicts', async () => {
  const prisma = new ContactsPrismaMock();
  prisma.createError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

  await assert.rejects(
    () =>
      service(prisma).create('user-a', {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.test',
      }),
    ConflictException,
  );
});
