import 'reflect-metadata';

import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA, MODULE_METADATA } from '@nestjs/common/constants';
import { ActivityType, DealStatus, MembershipRole, Prisma, Priority } from '@prisma/client';

import { AuthSharedModule } from '../../shared/guards/auth-shared.module';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { TenantContextModule } from '../../shared/tenant/tenant-context.module';
import { TenantContextService } from '../../shared/tenant/tenant-context.service';
import { DashboardController } from './dashboard.controller';
import { DashboardModule } from './dashboard.module';
import { DashboardService } from './dashboard.service';

const baseDate = new Date('2026-05-13T10:00:00.000Z');

type ActivityMetricRow = {
  tenantId: string;
  deletedAt: Date | null;
  completedAt: Date | null;
  dueAt: Date;
};

const recentDealRow = {
  id: 'deal-a',
  title: 'Acme Expansion',
  value: new Prisma.Decimal(1500),
  currency: 'EUR',
  status: DealStatus.OPEN,
  updatedAt: baseDate,
  organization: { id: 'org-a', name: 'Acme', domain: 'acme.test', deletedAt: null },
  person: {
    id: 'person-a',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.test',
    deletedAt: null,
  },
  stage: {
    id: 'stage-a',
    name: 'Demo geplant',
    position: 2,
    deletedAt: null,
  },
};

const recentActivityRow = {
  id: 'activity-a',
  type: ActivityType.TASK,
  priority: Priority.HIGH,
  subject: 'Follow up',
  dueAt: baseDate,
  completedAt: null,
  updatedAt: baseDate,
  organization: { id: 'org-a', name: 'Acme', domain: 'acme.test', deletedAt: null },
  person: {
    id: 'person-a',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.test',
    deletedAt: null,
  },
  deal: { id: 'deal-a', title: 'Acme Expansion', deletedAt: null },
};

const recentNoteRow = {
  id: 'note-a',
  type: 'NOTE',
  title: 'Discovery',
  content: '  Discovery notes with   whitespace  ',
  updatedAt: baseDate,
  organization: { id: 'org-a', name: 'Acme', domain: 'acme.test', deletedAt: null },
  person: {
    id: 'person-a',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.test',
    deletedAt: null,
  },
  deal: { id: 'deal-a', title: 'Acme Expansion', deletedAt: null },
  activity: { id: 'activity-a', subject: 'Follow up', type: ActivityType.TASK, deletedAt: null },
};

class DashboardPrismaMock {
  personCountArgs: unknown;
  organizationCountArgs: unknown;
  noteCountArgs: unknown;
  dealCountArgs: unknown;
  dealGroupByArgs: unknown[] = [];
  stageFindManyArgs: unknown;
  activityCountArgs: unknown[] = [];
  dealFindManyArgs: unknown;
  activityFindManyArgs: unknown;
  noteFindManyArgs: unknown;
  writeMethodCalls = 0;
  softDeletedRelations = false;
  nullableDealValues = false;
  activityMetricRows: ActivityMetricRow[] | null = null;

  person = {
    count: async (args: unknown): Promise<number> => {
      this.personCountArgs = args;
      return 7;
    },
    create: async (): Promise<never> => this.recordWrite(),
  };

  organization = {
    count: async (args: unknown): Promise<number> => {
      this.organizationCountArgs = args;
      return 3;
    },
    updateMany: async (): Promise<never> => this.recordWrite(),
  };

  note = {
    count: async (args: unknown): Promise<number> => {
      this.noteCountArgs = args;
      return 4;
    },
    findMany: async (args: unknown): Promise<unknown[]> => {
      this.noteFindManyArgs = args;
      return [this.recentNoteRow()];
    },
    updateMany: async (): Promise<never> => this.recordWrite(),
  };

  activity = {
    count: async (args: unknown): Promise<number> => {
      this.activityCountArgs.push(args);

      if (this.activityMetricRows) {
        const where = record(record(args).where);
        return this.activityMetricRows.filter((row) => matchesActivityMetricWhere(row, where))
          .length;
      }

      return this.activityCountArgs.length;
    },
    findMany: async (args: unknown): Promise<unknown[]> => {
      this.activityFindManyArgs = args;
      return [this.recentActivityRow()];
    },
    create: async (): Promise<never> => this.recordWrite(),
    updateMany: async (): Promise<never> => this.recordWrite(),
  };

  deal = {
    count: async (args: unknown): Promise<number> => {
      this.dealCountArgs = args;
      return 5;
    },
    groupBy: async (args: unknown): Promise<unknown[]> => {
      this.dealGroupByArgs.push(args);

      if (this.dealGroupByArgs.length === 1) {
        return [
          { status: DealStatus.OPEN, _count: { _all: 3 } },
          { status: DealStatus.WON, _count: { _all: 1 } },
          { status: DealStatus.LOST, _count: { _all: 1 } },
        ];
      }

      if (this.dealGroupByArgs.length === 2) {
        return [
          {
            status: DealStatus.OPEN,
            currency: 'EUR',
            _count: { _all: 2 },
            _sum: { value: new Prisma.Decimal(1000) },
          },
          {
            status: DealStatus.OPEN,
            currency: 'USD',
            _count: { _all: 1 },
            _sum: { value: this.nullableDealValues ? null : new Prisma.Decimal(2000) },
          },
          {
            status: DealStatus.WON,
            currency: 'EUR',
            _count: { _all: 1 },
            _sum: { value: new Prisma.Decimal(500) },
          },
        ];
      }

      return [
        {
          stageId: 'stage-a',
          currency: 'EUR',
          _count: { _all: 2 },
          _sum: { value: new Prisma.Decimal(1000) },
        },
        {
          stageId: 'stage-a',
          currency: 'USD',
          _count: { _all: 1 },
          _sum: { value: this.nullableDealValues ? null : new Prisma.Decimal(2000) },
        },
        {
          stageId: 'stage-deleted',
          currency: 'EUR',
          _count: { _all: 1 },
          _sum: { value: new Prisma.Decimal(500) },
        },
      ];
    },
    findMany: async (args: unknown): Promise<unknown[]> => {
      this.dealFindManyArgs = args;
      return [this.recentDealRow()];
    },
    create: async (): Promise<never> => this.recordWrite(),
    updateMany: async (): Promise<never> => this.recordWrite(),
  };

  stage = {
    findMany: async (args: unknown): Promise<unknown[]> => {
      this.stageFindManyArgs = args;
      return [{ id: 'stage-a', name: 'Demo geplant', position: 2 }];
    },
    upsert: async (): Promise<never> => this.recordWrite(),
  };

  private recordWrite(): never {
    this.writeMethodCalls += 1;
    throw new Error('Dashboard overview must stay read-only');
  }

  private recentDealRow(): unknown {
    return this.softDeletedRelations
      ? {
          ...recentDealRow,
          organization: { ...recentDealRow.organization, deletedAt: baseDate },
          person: { ...recentDealRow.person, deletedAt: baseDate },
          stage: { ...recentDealRow.stage, deletedAt: baseDate },
        }
      : recentDealRow;
  }

  private recentActivityRow(): unknown {
    return this.softDeletedRelations
      ? {
          ...recentActivityRow,
          organization: { ...recentActivityRow.organization, deletedAt: baseDate },
          person: { ...recentActivityRow.person, deletedAt: baseDate },
          deal: { ...recentActivityRow.deal, deletedAt: baseDate },
        }
      : recentActivityRow;
  }

  private recentNoteRow(): unknown {
    return this.softDeletedRelations
      ? {
          ...recentNoteRow,
          organization: { ...recentNoteRow.organization, deletedAt: baseDate },
          person: { ...recentNoteRow.person, deletedAt: baseDate },
          deal: { ...recentNoteRow.deal, deletedAt: baseDate },
          activity: { ...recentNoteRow.activity, deletedAt: baseDate },
        }
      : recentNoteRow;
  }
}

class TenantContextMock {
  role: MembershipRole = MembershipRole.OWNER;
  resolveCalls: string[] = [];
  assertCanWriteCalls = 0;

  resolveForUser = async (
    userId: string,
  ): Promise<{
    tenantId: string;
    membershipId: string;
    role: MembershipRole;
  }> => {
    this.resolveCalls.push(userId);
    return {
      tenantId: 'tenant-a',
      membershipId: 'membership-a',
      role: this.role,
    };
  };

  assertCanWrite(): void {
    this.assertCanWriteCalls += 1;
    throw new Error('Dashboard overview must not require write permissions');
  }
}

function record(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, 'object');
  assert.notEqual(value, null);
  assert.equal(Array.isArray(value), false);

  return value as Record<string, unknown>;
}

function matchesActivityMetricWhere(
  row: ActivityMetricRow,
  where: Record<string, unknown>,
): boolean {
  if (where.tenantId !== row.tenantId) {
    return false;
  }

  if (where.deletedAt !== row.deletedAt) {
    return false;
  }

  if (!matchesCompletedAt(row.completedAt, where.completedAt)) {
    return false;
  }

  if (where.dueAt === undefined) {
    return true;
  }

  const dueAt = record(where.dueAt);
  const gte = dueAt.gte;
  const lt = dueAt.lt;

  if (gte !== undefined) {
    assert.ok(gte instanceof Date);

    if (row.dueAt < gte) {
      return false;
    }
  }

  if (lt !== undefined) {
    assert.ok(lt instanceof Date);

    if (row.dueAt >= lt) {
      return false;
    }
  }

  return true;
}

function matchesCompletedAt(value: Date | null, condition: unknown): boolean {
  if (condition === null) {
    return value === null;
  }

  const conditionRecord = record(condition);
  return conditionRecord.not === null && value !== null;
}

function service(prisma: DashboardPrismaMock, tenantContext = new TenantContextMock()) {
  return new DashboardService(
    prisma as unknown as PrismaService,
    tenantContext as unknown as TenantContextService,
  );
}

test('DashboardController requires JwtAuthGuard and rejects missing user', () => {
  const controller = new DashboardController(service(new DashboardPrismaMock()));
  const guards = Reflect.getMetadata(GUARDS_METADATA, DashboardController) as unknown[];

  assert.ok(guards.includes(JwtAuthGuard));
  assert.throws(() => controller.overview(undefined), UnauthorizedException);
});

test('DashboardModule imports auth, Prisma and tenant context modules', () => {
  const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, DashboardModule) as unknown[];

  assert.ok(imports.includes(AuthSharedModule));
  assert.ok(imports.includes(PrismaModule));
  assert.ok(imports.includes(TenantContextModule));
});

test('DashboardService resolves tenant context and scopes metrics to active tenant data', async () => {
  const prisma = new DashboardPrismaMock();
  const tenantContext = new TenantContextMock();
  await service(prisma, tenantContext).overview('user-a');

  assert.deepEqual(tenantContext.resolveCalls, ['user-a']);
  assert.equal(record(record(prisma.personCountArgs).where).tenantId, 'tenant-a');
  assert.equal(record(record(prisma.personCountArgs).where).deletedAt, null);
  assert.equal(record(record(prisma.organizationCountArgs).where).tenantId, 'tenant-a');
  assert.equal(record(record(prisma.dealCountArgs).where).deletedAt, null);
  assert.equal(record(record(prisma.noteCountArgs).where).tenantId, 'tenant-a');
  assert.equal(record(record(prisma.dealGroupByArgs[0]).where).tenantId, 'tenant-a');
  assert.equal(record(record(prisma.stageFindManyArgs).where).deletedAt, null);
});

test('DashboardService calculates deal status counts and server-side values', async () => {
  const result = await service(new DashboardPrismaMock()).overview('user-a');

  assert.equal(result.summary.activeDealsCount, 5);
  assert.equal(result.summary.openDealsCount, 3);
  assert.equal(result.summary.wonDealsCount, 1);
  assert.equal(result.summary.lostDealsCount, 1);
  assert.deepEqual(result.pipeline.openPipelineValueByCurrency, [
    { currency: 'EUR', value: '1000' },
    { currency: 'USD', value: '2000' },
  ]);
  assert.deepEqual(result.pipeline.wonDealValueByCurrency, [{ currency: 'EUR', value: '500' }]);
  assert.equal(result.pipeline.dealsByStatus[0]?.status, DealStatus.OPEN);
  assert.equal(result.pipeline.dealsByStatus[0]?.count, 3);
  assert.deepEqual(result.pipeline.dealsByStatus[0]?.totalValueByCurrency, [
    { currency: 'EUR', value: '1000' },
    { currency: 'USD', value: '2000' },
  ]);
});

test('DashboardService treats nullable deal values as zero', async () => {
  const prisma = new DashboardPrismaMock();
  prisma.nullableDealValues = true;

  const result = await service(prisma).overview('user-a');

  assert.deepEqual(result.pipeline.openPipelineValueByCurrency, [
    { currency: 'EUR', value: '1000' },
    { currency: 'USD', value: '0' },
  ]);
});

test('DashboardService groups deals by active stage and redacts deleted stages', async () => {
  const result = await service(new DashboardPrismaMock()).overview('user-a');

  assert.deepEqual(result.pipeline.dealsByStage, [
    {
      stageId: 'stage-a',
      stageName: 'Demo geplant',
      stagePosition: 2,
      count: 3,
      totalValueByCurrency: [
        { currency: 'EUR', value: '1000' },
        { currency: 'USD', value: '2000' },
      ],
    },
    {
      stageId: 'stage-deleted',
      stageName: null,
      stagePosition: null,
      count: 1,
      totalValueByCurrency: [{ currency: 'EUR', value: '500' }],
    },
  ]);
});

test('DashboardService counts overdue activities only when open', async () => {
  const prisma = new DashboardPrismaMock();
  const beforeOverview = new Date();
  await service(prisma).overview('user-a');
  const afterOverview = new Date();

  const overdueWhere = record(record(prisma.activityCountArgs[2]).where);
  const dueTodayWhere = record(record(prisma.activityCountArgs[3]).where);
  const upcomingWhere = record(record(prisma.activityCountArgs[4]).where);
  const overdueDueAt = record(overdueWhere.dueAt);
  const dueTodayDueAt = record(dueTodayWhere.dueAt);

  assert.equal(overdueWhere.tenantId, 'tenant-a');
  assert.equal(overdueWhere.deletedAt, null);
  assert.equal(overdueWhere.completedAt, null);
  assert.ok(overdueDueAt.lt instanceof Date);
  assert.ok(overdueDueAt.lt >= beforeOverview);
  assert.ok(overdueDueAt.lt <= afterOverview);
  assert.equal(dueTodayWhere.tenantId, 'tenant-a');
  assert.equal(dueTodayWhere.deletedAt, null);
  assert.equal(dueTodayWhere.completedAt, null);
  assert.ok(dueTodayDueAt.gte instanceof Date);
  assert.equal(dueTodayDueAt.gte.getTime(), overdueDueAt.lt.getTime());
  assert.ok(dueTodayDueAt.lt instanceof Date);
  assert.equal(upcomingWhere.completedAt, null);
  assert.ok(record(upcomingWhere.dueAt).gte instanceof Date);
});

test('DashboardService classifies activity metrics against current time', async () => {
  mock.timers.enable({
    apis: ['Date'],
    now: new Date('2026-05-13T15:00:00.000Z'),
  });

  try {
    const prisma = new DashboardPrismaMock();
    prisma.activityMetricRows = [
      {
        tenantId: 'tenant-a',
        deletedAt: null,
        completedAt: null,
        dueAt: new Date('2026-05-13T10:00:00.000Z'),
      },
      {
        tenantId: 'tenant-a',
        deletedAt: null,
        completedAt: null,
        dueAt: new Date('2026-05-13T18:00:00.000Z'),
      },
      {
        tenantId: 'tenant-a',
        deletedAt: null,
        completedAt: new Date('2026-05-13T11:00:00.000Z'),
        dueAt: new Date('2026-05-13T10:00:00.000Z'),
      },
      {
        tenantId: 'tenant-a',
        deletedAt: new Date('2026-05-13T11:00:00.000Z'),
        completedAt: null,
        dueAt: new Date('2026-05-13T10:00:00.000Z'),
      },
    ];

    const result = await service(prisma).overview('user-a');

    assert.equal(result.summary.openActivitiesCount, 2);
    assert.equal(result.summary.completedActivitiesCount, 1);
    assert.equal(result.summary.overdueActivitiesCount, 1);
    assert.equal(result.summary.dueTodayActivitiesCount, 1);
  } finally {
    mock.timers.reset();
  }
});

test('DashboardService limits recent items and serializes soft-deleted relations as null', async () => {
  const prisma = new DashboardPrismaMock();
  prisma.softDeletedRelations = true;
  const result = await service(prisma).overview('user-a');

  assert.equal(record(prisma.dealFindManyArgs).take, 5);
  assert.equal(record(prisma.activityFindManyArgs).take, 5);
  assert.equal(record(prisma.noteFindManyArgs).take, 5);
  assert.equal(result.recent.deals[0]?.organization, null);
  assert.equal(result.recent.deals[0]?.person, null);
  assert.equal(result.recent.deals[0]?.stage, null);
  assert.equal(result.recent.activities[0]?.organization, null);
  assert.equal(result.recent.activities[0]?.person, null);
  assert.equal(result.recent.activities[0]?.deal, null);
  assert.equal(result.recent.notes[0]?.organization, null);
  assert.equal(result.recent.notes[0]?.person, null);
  assert.equal(result.recent.notes[0]?.deal, null);
  assert.equal(result.recent.notes[0]?.activity, null);
});

test('DashboardService allows read-only users and performs no writes', async () => {
  const prisma = new DashboardPrismaMock();
  const tenantContext = new TenantContextMock();
  tenantContext.role = MembershipRole.READ_ONLY;

  const result = await service(prisma, tenantContext).overview('user-a');

  assert.equal(result.summary.activeContactsCount, 7);
  assert.equal(tenantContext.assertCanWriteCalls, 0);
  assert.equal(prisma.writeMethodCalls, 0);
});
