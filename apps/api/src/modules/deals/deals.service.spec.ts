import 'reflect-metadata';

import assert from 'node:assert/strict';
import test from 'node:test';

import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { DealStatus, MembershipRole, Prisma } from '@prisma/client';

import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AuthSharedModule } from '../../shared/guards/auth-shared.module';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TenantContextModule } from '../../shared/tenant/tenant-context.module';
import { TenantContextService } from '../../shared/tenant/tenant-context.service';
import { DealsController } from './deals.controller';
import { DealsModule } from './deals.module';
import { DealsService } from './deals.service';

const stageRow = {
  id: 'stage-a',
  name: 'Qualifiziert',
  position: 1,
  probability: 15,
};

const pipelineRow = {
  id: 'pipeline-a',
  name: 'Vertriebs-Pipeline',
  stages: [stageRow],
};

const dealRow = {
  id: 'deal-a',
  organizationId: 'org-a',
  personId: 'person-a',
  pipelineId: 'pipeline-a',
  stageId: 'stage-a',
  ownerId: 'membership-a',
  title: 'Acme Deal',
  description: null,
  value: new Prisma.Decimal(1000),
  currency: 'EUR',
  status: DealStatus.OPEN,
  expectedCloseAt: null,
  closedAt: null,
  lostReason: null,
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
  stage: stageRow,
};

class DealsPrismaMock {
  dealCountArgs: unknown;
  dealFindManyArgs: unknown;
  dealFindFirstArgs: unknown;
  dealCreateArgs: unknown;
  dealUpdateManyArgs: unknown;
  dealUpdateArgs: unknown;
  pipelineUpsertArgs: unknown[] = [];
  pipelineCreateArgs: unknown[] = [];
  pipelineFindFirstArgs: unknown;
  pipelineUpdateArgs: unknown[] = [];
  stageUpsertArgs: unknown[] = [];
  stageCreateArgs: unknown[] = [];
  stageFindFirstArgs: unknown;
  stageUpdateArgs: unknown[] = [];
  organizationFindFirstArgs: unknown;
  personFindFirstArgs: unknown;
  dealExists = true;
  organizationExists = true;
  personExists = true;
  stageExists = true;
  updateManyCount = 1;
  transactionCallCount = 0;
  dealOrganizationDeletedAt: Date | null = null;
  dealPersonDeletedAt: Date | null = null;

  private dealRow(): unknown {
    return {
      ...dealRow,
      organization: {
        ...dealRow.organization,
        deletedAt: this.dealOrganizationDeletedAt,
      },
      person: {
        ...dealRow.person,
        deletedAt: this.dealPersonDeletedAt,
      },
    };
  }

  deal = {
    count: async (args: unknown): Promise<number> => {
      this.dealCountArgs = args;
      return 1;
    },
    findMany: async (args: unknown): Promise<unknown[]> => {
      this.dealFindManyArgs = args;
      return [this.dealRow()];
    },
    findFirst: async (args: unknown): Promise<unknown> => {
      this.dealFindFirstArgs = args;
      return this.dealExists ? this.dealRow() : null;
    },
    create: async (args: unknown): Promise<unknown> => {
      this.dealCreateArgs = args;
      return this.dealRow();
    },
    updateMany: async (args: unknown): Promise<{ count: number }> => {
      this.dealUpdateManyArgs = args;
      return { count: this.updateManyCount };
    },
    update: async (args: unknown): Promise<unknown> => {
      this.dealUpdateArgs = args;
      return this.dealRow();
    },
  };

  pipeline = {
    create: async (args: unknown): Promise<unknown> => {
      this.pipelineCreateArgs.push(args);
      return { id: 'pipeline-a' };
    },
    upsert: async (args: unknown): Promise<unknown> => {
      this.pipelineUpsertArgs.push(args);
      return { id: 'pipeline-a' };
    },
    update: async (args: unknown): Promise<unknown> => {
      this.pipelineUpdateArgs.push(args);
      return { id: 'pipeline-a' };
    },
    findFirst: async (args: unknown): Promise<unknown> => {
      this.pipelineFindFirstArgs = args;
      return pipelineRow;
    },
  };

  stage = {
    create: async (args: unknown): Promise<unknown> => {
      this.stageCreateArgs.push(args);
      return { id: 'stage-a' };
    },
    upsert: async (args: unknown): Promise<unknown> => {
      this.stageUpsertArgs.push(args);
      return { id: 'stage-a' };
    },
    update: async (args: unknown): Promise<unknown> => {
      this.stageUpdateArgs.push(args);
      return { id: 'stage-a' };
    },
    findFirst: async (args: unknown): Promise<unknown> => {
      this.stageFindFirstArgs = args;
      return this.stageExists ? stageRow : null;
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

  async $transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    this.transactionCallCount += 1;
    return callback(this as unknown as Prisma.TransactionClient);
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
  prisma: DealsPrismaMock,
  tenantContext: WritableTenantContextMock = new WritableTenantContextMock(),
) {
  return new DealsService(
    prisma as unknown as PrismaService,
    tenantContext as unknown as TenantContextService,
  );
}

test('DealsController requires JwtAuthGuard and rejects missing user', () => {
  const controller = new DealsController(service(new DealsPrismaMock()));
  const guards = Reflect.getMetadata(GUARDS_METADATA, DealsController) as unknown[];

  assert.ok(guards.includes(JwtAuthGuard));
  assert.throws(() => controller.list(undefined, {}), UnauthorizedException);
});

test('DealsModule imports auth, Prisma and tenant context modules', () => {
  const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, DealsModule) as unknown[];

  assert.ok(imports.includes(AuthSharedModule));
  assert.ok(imports.includes(PrismaModule));
  assert.ok(imports.includes(TenantContextModule));
});

test('DealsService scopes list queries to tenant and excludes soft-deleted deals', async () => {
  const prisma = new DealsPrismaMock();
  await service(prisma).list('user-a', {
    search: 'acme',
    status: DealStatus.OPEN,
    stageId: 'stage-a',
    page: 1,
    limit: 100,
  });
  const findManyArgs = record(prisma.dealFindManyArgs);
  const where = record(findManyArgs.where);

  assert.equal(where.tenantId, 'tenant-a');
  assert.equal(where.deletedAt, null);
  assert.equal(where.status, DealStatus.OPEN);
  assert.equal(where.stageId, 'stage-a');
  assert.equal(findManyArgs.take, 100);
  assert.equal(findManyArgs.skip, 0);
});

test('DealsService gets deals tenant-scoped and rejects missing or soft-deleted deals', async () => {
  const prisma = new DealsPrismaMock();
  await service(prisma).get('user-a', 'deal-a');
  assert.deepEqual(record(prisma.dealFindFirstArgs).where, {
    id: 'deal-a',
    tenantId: 'tenant-a',
    deletedAt: null,
  });

  prisma.dealExists = false;
  await assert.rejects(() => service(prisma).get('user-a', 'deal-a'), NotFoundException);
});

test('DealsService reads default pipeline for read-only users without mutating data', async () => {
  const prisma = new DealsPrismaMock();
  const pipeline = await service(prisma, new ReadOnlyTenantContextMock()).getDefaultPipeline(
    'user-a',
  );
  const findFirstArgs = record(prisma.pipelineFindFirstArgs);

  assert.equal(pipeline.id, 'pipeline-a');
  assert.deepEqual(findFirstArgs.where, {
    tenantId: 'tenant-a',
    isDefault: true,
    deletedAt: null,
  });
  assert.equal(prisma.transactionCallCount, 0);
  assert.equal(prisma.pipelineUpsertArgs.length, 0);
  assert.equal(prisma.pipelineCreateArgs.length, 0);
  assert.equal(prisma.pipelineUpdateArgs.length, 0);
  assert.equal(prisma.stageUpsertArgs.length, 0);
  assert.equal(prisma.stageCreateArgs.length, 0);
  assert.equal(prisma.stageUpdateArgs.length, 0);
});

test('DealsService hides soft-deleted related contacts in list and get responses', async () => {
  const prisma = new DealsPrismaMock();
  prisma.dealPersonDeletedAt = new Date('2026-02-01T00:00:00.000Z');
  const dealsService = service(prisma);

  const listResult = await dealsService.list('user-a', {});
  const getResult = await dealsService.get('user-a', 'deal-a');

  assert.equal(listResult.items[0]?.person, null);
  assert.equal(getResult.person, null);
});

test('DealsService hides soft-deleted related organizations in list and get responses', async () => {
  const prisma = new DealsPrismaMock();
  prisma.dealOrganizationDeletedAt = new Date('2026-02-01T00:00:00.000Z');
  const dealsService = service(prisma);

  const listResult = await dealsService.list('user-a', {});
  const getResult = await dealsService.get('user-a', 'deal-a');

  assert.equal(listResult.items[0]?.organization, null);
  assert.equal(getResult.organization, null);
});

test('DealsService keeps active related contact data in deal responses', async () => {
  const prisma = new DealsPrismaMock();
  const dealsService = service(prisma);

  const listResult = await dealsService.list('user-a', {});
  const getResult = await dealsService.get('user-a', 'deal-a');

  assert.deepEqual(listResult.items[0]?.person, {
    id: 'person-a',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.test',
  });
  assert.deepEqual(getResult.person, {
    id: 'person-a',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.test',
  });
});

test('DealsService keeps active related organization data in deal responses', async () => {
  const prisma = new DealsPrismaMock();
  const dealsService = service(prisma);

  const listResult = await dealsService.list('user-a', {});
  const getResult = await dealsService.get('user-a', 'deal-a');

  assert.deepEqual(listResult.items[0]?.organization, {
    id: 'org-a',
    name: 'Acme',
    domain: 'acme.test',
  });
  assert.deepEqual(getResult.organization, {
    id: 'org-a',
    name: 'Acme',
    domain: 'acme.test',
  });
});

test('DealsService creates deals with current membership and default pipeline stage', async () => {
  const prisma = new DealsPrismaMock();
  await service(prisma).create('user-a', {
    title: ' Acme Deal ',
    value: 1200,
    organizationId: 'org-a',
    personId: 'person-a',
  });
  const data = record(record(prisma.dealCreateArgs).data);

  assert.equal(data.tenantId, 'tenant-a');
  assert.equal(data.ownerId, 'membership-a');
  assert.equal(data.pipelineId, 'pipeline-a');
  assert.equal(data.stageId, 'stage-a');
  assert.equal(data.title, 'Acme Deal');
  assert.equal(data.currency, 'EUR');
  assert.equal(data.status, DealStatus.OPEN);
  assert.equal(record(record(prisma.organizationFindFirstArgs).where).tenantId, 'tenant-a');
  assert.equal(record(record(prisma.personFindFirstArgs).where).tenantId, 'tenant-a');
  assert.equal(prisma.stageUpsertArgs.length, 6);
});

test('DealsService rejects cross-tenant or soft-deleted organization, contact and stage links', async () => {
  const missingOrganizationPrisma = new DealsPrismaMock();
  missingOrganizationPrisma.organizationExists = false;
  await assert.rejects(
    () =>
      service(missingOrganizationPrisma).create('user-a', {
        title: 'Acme Deal',
        organizationId: 'org-other',
      }),
    NotFoundException,
  );

  const missingPersonPrisma = new DealsPrismaMock();
  missingPersonPrisma.personExists = false;
  await assert.rejects(
    () =>
      service(missingPersonPrisma).create('user-a', {
        title: 'Acme Deal',
        personId: 'person-other',
      }),
    NotFoundException,
  );

  const missingStagePrisma = new DealsPrismaMock();
  missingStagePrisma.stageExists = false;
  await assert.rejects(
    () =>
      service(missingStagePrisma).create('user-a', {
        title: 'Acme Deal',
        stageId: 'stage-other',
      }),
    NotFoundException,
  );
});

test('DealsService updates and soft-deletes deals tenant-scoped', async () => {
  const prisma = new DealsPrismaMock();
  await service(prisma).update('user-a', 'deal-a', {
    description: null,
    organizationId: null,
    personId: null,
    expectedCloseAt: null,
    lostReason: null,
    stageId: 'stage-a',
  });

  assert.deepEqual(record(prisma.dealUpdateManyArgs).where, {
    id: 'deal-a',
    tenantId: 'tenant-a',
    deletedAt: null,
  });
  const updateData = record(record(prisma.dealUpdateManyArgs).data);
  assert.equal(updateData.description, null);
  assert.equal(updateData.organizationId, null);
  assert.equal(updateData.personId, null);
  assert.equal(updateData.expectedCloseAt, null);
  assert.equal(updateData.lostReason, null);

  await service(prisma).remove('user-a', 'deal-a');
  const deleteData = record(record(prisma.dealUpdateArgs).data);
  assert.ok(deleteData.deletedAt instanceof Date);
});

test('DealsService allows unrelated edits when stale organization id is cleared', async () => {
  const prisma = new DealsPrismaMock();
  prisma.organizationExists = false;

  await service(prisma).update('user-a', 'deal-a', {
    title: 'Updated Deal',
    organizationId: null,
  });

  const updateData = record(record(prisma.dealUpdateManyArgs).data);
  assert.equal(updateData.title, 'Updated Deal');
  assert.equal(updateData.organizationId, null);
  assert.equal(prisma.organizationFindFirstArgs, undefined);
});

test('DealsService does not patch soft-deleted deals', async () => {
  const prisma = new DealsPrismaMock();
  prisma.dealExists = false;

  await assert.rejects(
    () => service(prisma).update('user-a', 'deal-a', { title: 'Updated' }),
    NotFoundException,
  );
});

test('DealsService blocks writes for read-only memberships', async () => {
  const prisma = new DealsPrismaMock();

  await assert.rejects(
    () => service(prisma, new ReadOnlyTenantContextMock()).create('user-a', { title: 'Deal' }),
    ForbiddenException,
  );
});
