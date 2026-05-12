import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { ActivityType, MembershipRole, Priority } from '@prisma/client';

import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AuthSharedModule } from '../../shared/guards/auth-shared.module';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TenantContextModule } from '../../shared/tenant/tenant-context.module';
import { TenantContextService } from '../../shared/tenant/tenant-context.service';
import { ActivitiesController } from './activities.controller';
import { ActivitiesModule } from './activities.module';
import { ActivitiesService } from './activities.service';
import { ActivityCompletionFilter, ActivityDueFilter } from './dto/list-activities.dto';

const activityRow = {
  id: 'activity-a',
  organizationId: 'org-a',
  personId: 'person-a',
  dealId: 'deal-a',
  ownerId: 'membership-a',
  type: ActivityType.TASK,
  priority: Priority.MEDIUM,
  subject: 'Follow up',
  body: null,
  dueAt: null,
  completedAt: null,
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
};

class ActivitiesPrismaMock {
  activityCountArgs: unknown;
  activityFindManyArgs: unknown;
  activityFindFirstArgs: unknown;
  activityCreateArgs: unknown;
  activityUpdateManyArgs: unknown;
  activityFindFirstCalls: unknown[] = [];
  organizationFindFirstArgs: unknown;
  personFindFirstArgs: unknown;
  dealFindFirstArgs: unknown;
  activityExists = true;
  organizationExists = true;
  personExists = true;
  dealExists = true;
  updateManyCount = 1;
  transactionCallCount = 0;
  activityOrganizationDeletedAt: Date | null = null;
  activityPersonDeletedAt: Date | null = null;
  activityDealDeletedAt: Date | null = null;

  private activityRow(): unknown {
    return {
      ...activityRow,
      organization: {
        ...activityRow.organization,
        deletedAt: this.activityOrganizationDeletedAt,
      },
      person: {
        ...activityRow.person,
        deletedAt: this.activityPersonDeletedAt,
      },
      deal: {
        ...activityRow.deal,
        deletedAt: this.activityDealDeletedAt,
      },
    };
  }

  activity = {
    count: async (args: unknown): Promise<number> => {
      this.activityCountArgs = args;
      return 1;
    },
    findMany: async (args: unknown): Promise<unknown[]> => {
      this.activityFindManyArgs = args;
      return [this.activityRow()];
    },
    findFirst: async (args: unknown): Promise<unknown> => {
      this.activityFindFirstArgs = args;
      this.activityFindFirstCalls.push(args);
      return this.activityExists ? this.activityRow() : null;
    },
    create: async (args: unknown): Promise<unknown> => {
      this.activityCreateArgs = args;
      return this.activityRow();
    },
    updateMany: async (args: unknown): Promise<{ count: number }> => {
      this.activityUpdateManyArgs = args;
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
  prisma: ActivitiesPrismaMock,
  tenantContext: WritableTenantContextMock = new WritableTenantContextMock(),
) {
  return new ActivitiesService(
    prisma as unknown as PrismaService,
    tenantContext as unknown as TenantContextService,
  );
}

test('ActivitiesController requires JwtAuthGuard and rejects missing user', () => {
  const controller = new ActivitiesController(service(new ActivitiesPrismaMock()));
  const guards = Reflect.getMetadata(GUARDS_METADATA, ActivitiesController) as unknown[];

  assert.ok(guards.includes(JwtAuthGuard));
  assert.throws(() => controller.list(undefined, {}), UnauthorizedException);
});

test('ActivitiesModule imports auth, Prisma and tenant context modules', () => {
  const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, ActivitiesModule) as unknown[];

  assert.ok(imports.includes(AuthSharedModule));
  assert.ok(imports.includes(PrismaModule));
  assert.ok(imports.includes(TenantContextModule));
});

test('ActivitiesService scopes list queries to tenant and excludes soft-deleted activities', async () => {
  const prisma = new ActivitiesPrismaMock();
  await service(prisma).list('user-a', {
    search: 'acme',
    type: ActivityType.CALL,
    priority: Priority.HIGH,
    completion: ActivityCompletionFilter.OPEN,
    due: ActivityDueFilter.OVERDUE,
    organizationId: 'org-a',
    personId: 'person-a',
    dealId: 'deal-a',
    page: 1,
    limit: 100,
  });
  const findManyArgs = record(prisma.activityFindManyArgs);
  const where = record(findManyArgs.where);

  assert.equal(where.tenantId, 'tenant-a');
  assert.equal(where.deletedAt, null);
  assert.equal(where.type, ActivityType.CALL);
  assert.equal(where.priority, Priority.HIGH);
  assert.equal(where.completedAt, null);
  assert.ok(record(where.dueAt).lt instanceof Date);
  assert.equal(where.organizationId, 'org-a');
  assert.equal(where.personId, 'person-a');
  assert.equal(where.dealId, 'deal-a');
  assert.equal(findManyArgs.take, 100);
  assert.equal(findManyArgs.skip, 0);
});

test('ActivitiesService returns no rows for completed overdue filters', async () => {
  const prisma = new ActivitiesPrismaMock();
  const result = await service(prisma).list('user-a', {
    completion: ActivityCompletionFilter.COMPLETED,
    due: ActivityDueFilter.OVERDUE,
  });

  assert.deepEqual(result, {
    items: [],
    page: 1,
    limit: 25,
    total: 0,
  });
  assert.equal(prisma.activityCountArgs, undefined);
  assert.equal(prisma.activityFindManyArgs, undefined);
});

test('ActivitiesService returns open overdue rows for explicit open overdue filters', async () => {
  const prisma = new ActivitiesPrismaMock();
  await service(prisma).list('user-a', {
    completion: ActivityCompletionFilter.OPEN,
    due: ActivityDueFilter.OVERDUE,
  });
  const findManyArgs = record(prisma.activityFindManyArgs);
  const where = record(findManyArgs.where);

  assert.equal(where.completedAt, null);
  assert.ok(record(where.dueAt).lt instanceof Date);
});

test('ActivitiesService returns open overdue rows when overdue has no completion filter', async () => {
  const prisma = new ActivitiesPrismaMock();
  await service(prisma).list('user-a', {
    due: ActivityDueFilter.OVERDUE,
  });
  const findManyArgs = record(prisma.activityFindManyArgs);
  const where = record(findManyArgs.where);

  assert.equal(where.completedAt, null);
  assert.ok(record(where.dueAt).lt instanceof Date);
});

test('ActivitiesService preserves completion-only list filters', async () => {
  const openPrisma = new ActivitiesPrismaMock();
  await service(openPrisma).list('user-a', {
    completion: ActivityCompletionFilter.OPEN,
  });
  const openWhere = record(record(openPrisma.activityFindManyArgs).where);

  assert.equal(openWhere.completedAt, null);
  assert.equal(openWhere.dueAt, undefined);

  const completedPrisma = new ActivitiesPrismaMock();
  await service(completedPrisma).list('user-a', {
    completion: ActivityCompletionFilter.COMPLETED,
  });
  const completedWhere = record(record(completedPrisma.activityFindManyArgs).where);

  assert.equal(record(completedWhere.completedAt).not, null);
  assert.equal(completedWhere.dueAt, undefined);
});

test('ActivitiesService gets activities tenant-scoped and rejects missing or soft-deleted activities', async () => {
  const prisma = new ActivitiesPrismaMock();
  await service(prisma).get('user-a', 'activity-a');
  assert.deepEqual(record(prisma.activityFindFirstArgs).where, {
    id: 'activity-a',
    tenantId: 'tenant-a',
    deletedAt: null,
  });

  prisma.activityExists = false;
  await assert.rejects(() => service(prisma).get('user-a', 'activity-a'), NotFoundException);
});

test('ActivitiesService hides soft-deleted related entities in list and get responses', async () => {
  const prisma = new ActivitiesPrismaMock();
  prisma.activityOrganizationDeletedAt = new Date('2026-02-01T00:00:00.000Z');
  prisma.activityPersonDeletedAt = new Date('2026-02-01T00:00:00.000Z');
  prisma.activityDealDeletedAt = new Date('2026-02-01T00:00:00.000Z');
  const activitiesService = service(prisma);

  const listResult = await activitiesService.list('user-a', {});
  const getResult = await activitiesService.get('user-a', 'activity-a');

  assert.equal(listResult.items[0]?.organization, null);
  assert.equal(listResult.items[0]?.person, null);
  assert.equal(listResult.items[0]?.deal, null);
  assert.equal(getResult.organization, null);
  assert.equal(getResult.person, null);
  assert.equal(getResult.deal, null);
});

test('ActivitiesService creates activities with current membership and active tenant relations', async () => {
  const prisma = new ActivitiesPrismaMock();
  await service(prisma).create('user-a', {
    subject: ' Follow up ',
    body: 'Call back',
    organizationId: 'org-a',
    personId: 'person-a',
    dealId: 'deal-a',
  });
  const data = record(record(prisma.activityCreateArgs).data);

  assert.equal(data.tenantId, 'tenant-a');
  assert.equal(data.ownerId, 'membership-a');
  assert.equal(data.subject, 'Follow up');
  assert.equal(data.type, ActivityType.TASK);
  assert.equal(data.priority, Priority.MEDIUM);
  assert.equal(data.organizationId, 'org-a');
  assert.equal(data.personId, 'person-a');
  assert.equal(data.dealId, 'deal-a');
  assert.equal(record(record(prisma.organizationFindFirstArgs).where).tenantId, 'tenant-a');
  assert.equal(record(record(prisma.organizationFindFirstArgs).where).deletedAt, null);
  assert.equal(record(record(prisma.personFindFirstArgs).where).tenantId, 'tenant-a');
  assert.equal(record(record(prisma.dealFindFirstArgs).where).tenantId, 'tenant-a');
});

test('ActivitiesService rejects cross-tenant or soft-deleted relation links', async () => {
  const missingOrganizationPrisma = new ActivitiesPrismaMock();
  missingOrganizationPrisma.organizationExists = false;
  await assert.rejects(
    () =>
      service(missingOrganizationPrisma).create('user-a', {
        subject: 'Follow up',
        organizationId: 'org-other',
      }),
    NotFoundException,
  );

  const missingPersonPrisma = new ActivitiesPrismaMock();
  missingPersonPrisma.personExists = false;
  await assert.rejects(
    () =>
      service(missingPersonPrisma).create('user-a', {
        subject: 'Follow up',
        personId: 'person-other',
      }),
    NotFoundException,
  );

  const missingDealPrisma = new ActivitiesPrismaMock();
  missingDealPrisma.dealExists = false;
  await assert.rejects(
    () =>
      service(missingDealPrisma).create('user-a', {
        subject: 'Follow up',
        dealId: 'deal-other',
      }),
    NotFoundException,
  );
});

test('ActivitiesService updates null cases and soft-deletes tenant-scoped', async () => {
  const prisma = new ActivitiesPrismaMock();
  await service(prisma).update('user-a', 'activity-a', {
    body: null,
    dueAt: null,
    organizationId: null,
    personId: null,
    dealId: null,
  });

  assert.deepEqual(record(prisma.activityUpdateManyArgs).where, {
    id: 'activity-a',
    tenantId: 'tenant-a',
    deletedAt: null,
  });
  const updateData = record(record(prisma.activityUpdateManyArgs).data);
  assert.equal(updateData.body, null);
  assert.equal(updateData.dueAt, null);
  assert.equal(updateData.organizationId, null);
  assert.equal(updateData.personId, null);
  assert.equal(updateData.dealId, null);

  await service(prisma).remove('user-a', 'activity-a');
  const deleteData = record(record(prisma.activityUpdateManyArgs).data);
  assert.ok(deleteData.deletedAt instanceof Date);
});

test('ActivitiesService allows unrelated edits when stale relation ids are cleared', async () => {
  const prisma = new ActivitiesPrismaMock();
  prisma.organizationExists = false;
  prisma.personExists = false;
  prisma.dealExists = false;

  await service(prisma).update('user-a', 'activity-a', {
    subject: 'Updated',
    organizationId: null,
    personId: null,
    dealId: null,
  });

  const updateData = record(record(prisma.activityUpdateManyArgs).data);
  assert.equal(updateData.subject, 'Updated');
  assert.equal(updateData.organizationId, null);
  assert.equal(updateData.personId, null);
  assert.equal(updateData.dealId, null);
  assert.equal(prisma.organizationFindFirstArgs, undefined);
  assert.equal(prisma.personFindFirstArgs, undefined);
  assert.equal(prisma.dealFindFirstArgs, undefined);
});

test('ActivitiesService does not patch soft-deleted activities', async () => {
  const prisma = new ActivitiesPrismaMock();
  prisma.activityExists = false;

  await assert.rejects(
    () => service(prisma).update('user-a', 'activity-a', { subject: 'Updated' }),
    NotFoundException,
  );
});

test('ActivitiesService completes and reopens activities server-side', async () => {
  const prisma = new ActivitiesPrismaMock();
  await service(prisma).complete('user-a', 'activity-a');
  assert.ok(record(record(prisma.activityUpdateManyArgs).data).completedAt instanceof Date);

  await service(prisma).reopen('user-a', 'activity-a');
  assert.equal(record(record(prisma.activityUpdateManyArgs).data).completedAt, null);
});

test('ActivitiesService blocks writes for read-only memberships', async () => {
  const prisma = new ActivitiesPrismaMock();

  await assert.rejects(
    () =>
      service(prisma, new ReadOnlyTenantContextMock()).create('user-a', {
        subject: 'Follow up',
      }),
    ForbiddenException,
  );
  await assert.rejects(
    () => service(prisma, new ReadOnlyTenantContextMock()).complete('user-a', 'activity-a'),
    ForbiddenException,
  );
});
