import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { ActivityType, MembershipRole } from '@prisma/client';

import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AuthSharedModule } from '../../shared/guards/auth-shared.module';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TenantContextModule } from '../../shared/tenant/tenant-context.module';
import { TenantContextService } from '../../shared/tenant/tenant-context.service';
import { NotesController } from './notes.controller';
import { NotesModule } from './notes.module';
import { NotesService } from './notes.service';

const noteRow = {
  id: 'note-a',
  organizationId: 'org-a',
  personId: 'person-a',
  dealId: 'deal-a',
  activityId: 'activity-a',
  authorId: 'membership-a',
  type: 'NOTE',
  title: 'Discovery',
  content: 'Plain text note',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  organization: { id: 'org-a', name: 'Acme', domain: 'acme.test', deletedAt: null },
  person: {
    id: 'person-a',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.test',
    deletedAt: null,
  },
  deal: { id: 'deal-a', title: 'Acme Deal', deletedAt: null },
  activity: { id: 'activity-a', subject: 'Follow up', type: ActivityType.TASK, deletedAt: null },
};

class NotesPrismaMock {
  noteCountArgs: unknown;
  noteFindManyArgs: unknown;
  noteFindFirstArgs: unknown;
  noteFindFirstCalls: unknown[] = [];
  noteCreateArgs: unknown;
  noteUpdateManyArgs: unknown;
  organizationFindFirstArgs: unknown;
  personFindFirstArgs: unknown;
  dealFindFirstArgs: unknown;
  activityFindFirstArgs: unknown;
  noteExists = true;
  organizationExists = true;
  personExists = true;
  dealExists = true;
  activityExists = true;
  updateManyCount = 1;
  transactionCallCount = 0;
  noteOrganizationDeletedAt: Date | null = null;
  notePersonDeletedAt: Date | null = null;
  noteDealDeletedAt: Date | null = null;
  noteActivityDeletedAt: Date | null = null;

  private noteRow(): unknown {
    return {
      ...noteRow,
      organization: {
        ...noteRow.organization,
        deletedAt: this.noteOrganizationDeletedAt,
      },
      person: {
        ...noteRow.person,
        deletedAt: this.notePersonDeletedAt,
      },
      deal: {
        ...noteRow.deal,
        deletedAt: this.noteDealDeletedAt,
      },
      activity: {
        ...noteRow.activity,
        deletedAt: this.noteActivityDeletedAt,
      },
    };
  }

  note = {
    count: async (args: unknown): Promise<number> => {
      this.noteCountArgs = args;
      return 1;
    },
    findMany: async (args: unknown): Promise<unknown[]> => {
      this.noteFindManyArgs = args;
      return [this.noteRow()];
    },
    findFirst: async (args: unknown): Promise<unknown> => {
      this.noteFindFirstArgs = args;
      this.noteFindFirstCalls.push(args);
      return this.noteExists ? this.noteRow() : null;
    },
    create: async (args: unknown): Promise<unknown> => {
      this.noteCreateArgs = args;
      return this.noteRow();
    },
    updateMany: async (args: unknown): Promise<{ count: number }> => {
      this.noteUpdateManyArgs = args;
      return { count: this.updateManyCount };
    },
  };

  organization = {
    findFirst: async (args: unknown): Promise<unknown> => {
      this.organizationFindFirstArgs = args;
      return this.organizationExists ? { id: 'org-a' } : null;
    },
  };

  person = {
    findFirst: async (args: unknown): Promise<unknown> => {
      this.personFindFirstArgs = args;
      return this.personExists ? { id: 'person-a' } : null;
    },
  };

  deal = {
    findFirst: async (args: unknown): Promise<unknown> => {
      this.dealFindFirstArgs = args;
      return this.dealExists ? { id: 'deal-a' } : null;
    },
  };

  activity = {
    findFirst: async (args: unknown): Promise<unknown> => {
      this.activityFindFirstArgs = args;
      return this.activityExists ? { id: 'activity-a' } : null;
    },
  };

  async $transaction<T>(callback: (tx: unknown) => Promise<T>): Promise<T> {
    this.transactionCallCount += 1;
    return callback(this);
  }
}

class WritableTenantContextMock {
  resolveForUser = async (): Promise<{
    tenantId: string;
    membershipId: string;
    role: MembershipRole;
  }> => ({
    tenantId: 'tenant-a',
    membershipId: 'membership-a',
    role: MembershipRole.OWNER,
  });

  assertCanWrite(): void {}
}

class ReadOnlyTenantContextMock extends WritableTenantContextMock {
  override resolveForUser = async (): Promise<{
    tenantId: string;
    membershipId: string;
    role: MembershipRole;
  }> => ({
    tenantId: 'tenant-a',
    membershipId: 'membership-a',
    role: MembershipRole.READ_ONLY,
  });

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

function service(
  prisma: NotesPrismaMock,
  tenantContext: WritableTenantContextMock = new WritableTenantContextMock(),
) {
  return new NotesService(
    prisma as unknown as PrismaService,
    tenantContext as unknown as TenantContextService,
  );
}

test('NotesController requires JwtAuthGuard and rejects missing user', () => {
  const controller = new NotesController(service(new NotesPrismaMock()));
  const guards = Reflect.getMetadata(GUARDS_METADATA, NotesController) as unknown[];

  assert.ok(guards.includes(JwtAuthGuard));
  assert.throws(() => controller.list(undefined, {}), UnauthorizedException);
});

test('NotesModule imports auth, Prisma and tenant context modules', () => {
  const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, NotesModule) as unknown[];

  assert.ok(imports.includes(AuthSharedModule));
  assert.ok(imports.includes(PrismaModule));
  assert.ok(imports.includes(TenantContextModule));
});

test('NotesService scopes list queries to tenant and supports search, relation filters and pagination', async () => {
  const prisma = new NotesPrismaMock();
  await service(prisma).list('user-a', {
    search: ' discovery ',
    type: 'comment',
    organizationId: 'org-a',
    personId: 'person-a',
    dealId: 'deal-a',
    activityId: 'activity-a',
    page: 2,
    limit: 50,
  });
  const findManyArgs = record(prisma.noteFindManyArgs);
  const where = record(findManyArgs.where);

  assert.equal(where.tenantId, 'tenant-a');
  assert.equal(where.deletedAt, null);
  assert.equal(where.type, 'COMMENT');
  assert.equal(where.organizationId, 'org-a');
  assert.equal(where.personId, 'person-a');
  assert.equal(where.dealId, 'deal-a');
  assert.equal(where.activityId, 'activity-a');
  assert.equal(Array.isArray(where.OR), true);
  assert.equal(findManyArgs.take, 50);
  assert.equal(findManyArgs.skip, 50);
});

test('NotesService gets notes tenant-scoped and rejects missing or soft-deleted notes', async () => {
  const prisma = new NotesPrismaMock();
  await service(prisma).get('user-a', 'note-a');
  assert.deepEqual(record(prisma.noteFindFirstArgs).where, {
    id: 'note-a',
    tenantId: 'tenant-a',
    deletedAt: null,
  });

  prisma.noteExists = false;
  await assert.rejects(() => service(prisma).get('user-a', 'note-a'), NotFoundException);
});

test('NotesService hides soft-deleted related entities in list and get responses', async () => {
  const prisma = new NotesPrismaMock();
  prisma.noteOrganizationDeletedAt = new Date('2026-02-01T00:00:00.000Z');
  prisma.notePersonDeletedAt = new Date('2026-02-01T00:00:00.000Z');
  prisma.noteDealDeletedAt = new Date('2026-02-01T00:00:00.000Z');
  prisma.noteActivityDeletedAt = new Date('2026-02-01T00:00:00.000Z');
  const notesService = service(prisma);

  const listResult = await notesService.list('user-a', {});
  const getResult = await notesService.get('user-a', 'note-a');

  assert.equal(listResult.items[0]?.organization, null);
  assert.equal(listResult.items[0]?.person, null);
  assert.equal(listResult.items[0]?.deal, null);
  assert.equal(listResult.items[0]?.activity, null);
  assert.equal(getResult.organization, null);
  assert.equal(getResult.person, null);
  assert.equal(getResult.deal, null);
  assert.equal(getResult.activity, null);
});

test('NotesService creates notes with server-side tenant and author and active same-tenant relations', async () => {
  const prisma = new NotesPrismaMock();
  await service(prisma).create('user-a', {
    title: ' Discovery ',
    content: ' Plain text ',
    type: 'comment',
    organizationId: 'org-a',
    personId: 'person-a',
    dealId: 'deal-a',
    activityId: 'activity-a',
  });
  const createArgs = record(prisma.noteCreateArgs);
  const data = record(createArgs.data);

  assert.equal(data.tenantId, 'tenant-a');
  assert.equal(data.authorId, 'membership-a');
  assert.equal(data.title, 'Discovery');
  assert.equal(data.content, 'Plain text');
  assert.equal(data.type, 'COMMENT');
  assert.deepEqual(record(prisma.organizationFindFirstArgs).where, {
    id: 'org-a',
    tenantId: 'tenant-a',
    deletedAt: null,
  });
  assert.deepEqual(record(prisma.personFindFirstArgs).where, {
    id: 'person-a',
    tenantId: 'tenant-a',
    deletedAt: null,
  });
  assert.deepEqual(record(prisma.dealFindFirstArgs).where, {
    id: 'deal-a',
    tenantId: 'tenant-a',
    deletedAt: null,
  });
  assert.deepEqual(record(prisma.activityFindFirstArgs).where, {
    id: 'activity-a',
    tenantId: 'tenant-a',
    deletedAt: null,
  });
});

test('NotesService rejects cross-tenant or soft-deleted relation targets', async () => {
  const dealPrisma = new NotesPrismaMock();
  dealPrisma.dealExists = false;
  await assert.rejects(
    () => service(dealPrisma).create('user-a', { content: 'Note', dealId: 'deal-a' }),
    NotFoundException,
  );
  assert.deepEqual(record(dealPrisma.dealFindFirstArgs).where, {
    id: 'deal-a',
    tenantId: 'tenant-a',
    deletedAt: null,
  });

  const activityPrisma = new NotesPrismaMock();
  activityPrisma.activityExists = false;
  await assert.rejects(
    () => service(activityPrisma).create('user-a', { content: 'Note', activityId: 'activity-a' }),
    NotFoundException,
  );
  assert.deepEqual(record(activityPrisma.activityFindFirstArgs).where, {
    id: 'activity-a',
    tenantId: 'tenant-a',
    deletedAt: null,
  });
});

test('NotesService blocks read-only writes', async () => {
  const notesService = service(new NotesPrismaMock(), new ReadOnlyTenantContextMock());

  await assert.rejects(
    () => notesService.create('user-a', { content: 'Note' }),
    ForbiddenException,
  );
  await assert.rejects(
    () => notesService.update('user-a', 'note-a', { content: 'Updated' }),
    ForbiddenException,
  );
  await assert.rejects(() => notesService.remove('user-a', 'note-a'), ForbiddenException);
});

test('NotesService patches nullable fields and refuses soft-deleted notes', async () => {
  const prisma = new NotesPrismaMock();
  await service(prisma).update('user-a', 'note-a', {
    title: null,
    content: ' Updated ',
    organizationId: null,
    personId: null,
    dealId: null,
    activityId: null,
  });
  const updateArgs = record(prisma.noteUpdateManyArgs);
  const data = record(updateArgs.data);

  assert.deepEqual(updateArgs.where, {
    id: 'note-a',
    tenantId: 'tenant-a',
    deletedAt: null,
  });
  assert.equal(data.title, null);
  assert.equal(data.content, 'Updated');
  assert.equal(data.organizationId, null);
  assert.equal(data.personId, null);
  assert.equal(data.dealId, null);
  assert.equal(data.activityId, null);

  const missingPrisma = new NotesPrismaMock();
  missingPrisma.noteExists = false;
  await assert.rejects(
    () => service(missingPrisma).update('user-a', 'note-a', { content: 'Updated' }),
    NotFoundException,
  );
});

test('NotesService soft-deletes notes', async () => {
  const prisma = new NotesPrismaMock();
  await service(prisma).remove('user-a', 'note-a');
  const updateArgs = record(prisma.noteUpdateManyArgs);
  const data = record(updateArgs.data);

  assert.deepEqual(updateArgs.where, {
    id: 'note-a',
    tenantId: 'tenant-a',
    deletedAt: null,
  });
  assert.ok(data.deletedAt instanceof Date);
});
