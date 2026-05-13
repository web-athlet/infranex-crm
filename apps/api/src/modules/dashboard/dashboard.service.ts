import { Injectable } from '@nestjs/common';
import { DealStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../shared/prisma/prisma.service';
import { TenantContextService } from '../../shared/tenant/tenant-context.service';

const RECENT_LIMIT = 5;

const dealStatuses = [DealStatus.OPEN, DealStatus.WON, DealStatus.LOST] as const;

const recentDealSelect = {
  id: true,
  title: true,
  value: true,
  currency: true,
  status: true,
  updatedAt: true,
  organization: {
    select: {
      id: true,
      name: true,
      domain: true,
      deletedAt: true,
    },
  },
  person: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      deletedAt: true,
    },
  },
  stage: {
    select: {
      id: true,
      name: true,
      position: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.DealSelect;

const recentActivitySelect = {
  id: true,
  type: true,
  priority: true,
  subject: true,
  dueAt: true,
  completedAt: true,
  updatedAt: true,
  organization: {
    select: {
      id: true,
      name: true,
      domain: true,
      deletedAt: true,
    },
  },
  person: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      deletedAt: true,
    },
  },
  deal: {
    select: {
      id: true,
      title: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.ActivitySelect;

const recentNoteSelect = {
  id: true,
  type: true,
  title: true,
  content: true,
  updatedAt: true,
  organization: {
    select: {
      id: true,
      name: true,
      domain: true,
      deletedAt: true,
    },
  },
  person: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      deletedAt: true,
    },
  },
  deal: {
    select: {
      id: true,
      title: true,
      deletedAt: true,
    },
  },
  activity: {
    select: {
      id: true,
      subject: true,
      type: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.NoteSelect;

type MoneyAmount = {
  currency: string;
  value: string;
};

type SelectedRecentDeal = Prisma.DealGetPayload<{ select: typeof recentDealSelect }>;
type SelectedRecentActivity = Prisma.ActivityGetPayload<{ select: typeof recentActivitySelect }>;
type SelectedRecentNote = Prisma.NoteGetPayload<{ select: typeof recentNoteSelect }>;

function startOfToday(now = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfToday(now = new Date()): Date {
  const end = startOfToday(now);
  end.setDate(end.getDate() + 1);
  return end;
}

function decimalToString(value: Prisma.Decimal | null | undefined): string {
  return value?.toString() ?? '0';
}

function mergeMoney(target: Map<string, Prisma.Decimal>, currency: string, value: Prisma.Decimal) {
  const current = target.get(currency) ?? new Prisma.Decimal(0);
  target.set(currency, current.plus(value));
}

function moneyFromMap(values: Map<string, Prisma.Decimal>): MoneyAmount[] {
  return [...values.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, value]) => ({
      currency,
      value: value.toString(),
    }));
}

function noteSnippet(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function serializeDeal(deal: SelectedRecentDeal) {
  return {
    id: deal.id,
    title: deal.title,
    value: decimalToString(deal.value),
    currency: deal.currency,
    status: deal.status,
    updatedAt: deal.updatedAt,
    organization:
      deal.organization?.deletedAt === null
        ? {
            id: deal.organization.id,
            name: deal.organization.name,
            domain: deal.organization.domain,
          }
        : null,
    person:
      deal.person?.deletedAt === null
        ? {
            id: deal.person.id,
            firstName: deal.person.firstName,
            lastName: deal.person.lastName,
            email: deal.person.email,
          }
        : null,
    stage:
      deal.stage.deletedAt === null
        ? {
            id: deal.stage.id,
            name: deal.stage.name,
            position: deal.stage.position,
          }
        : null,
  };
}

function serializeActivity(activity: SelectedRecentActivity) {
  return {
    id: activity.id,
    type: activity.type,
    priority: activity.priority,
    subject: activity.subject,
    dueAt: activity.dueAt,
    completedAt: activity.completedAt,
    updatedAt: activity.updatedAt,
    organization:
      activity.organization?.deletedAt === null
        ? {
            id: activity.organization.id,
            name: activity.organization.name,
            domain: activity.organization.domain,
          }
        : null,
    person:
      activity.person?.deletedAt === null
        ? {
            id: activity.person.id,
            firstName: activity.person.firstName,
            lastName: activity.person.lastName,
            email: activity.person.email,
          }
        : null,
    deal:
      activity.deal?.deletedAt === null
        ? {
            id: activity.deal.id,
            title: activity.deal.title,
          }
        : null,
  };
}

function serializeNote(note: SelectedRecentNote) {
  return {
    id: note.id,
    type: note.type,
    title: note.title,
    contentSnippet: noteSnippet(note.content),
    updatedAt: note.updatedAt,
    organization:
      note.organization?.deletedAt === null
        ? {
            id: note.organization.id,
            name: note.organization.name,
            domain: note.organization.domain,
          }
        : null,
    person:
      note.person?.deletedAt === null
        ? {
            id: note.person.id,
            firstName: note.person.firstName,
            lastName: note.person.lastName,
            email: note.person.email,
          }
        : null,
    deal:
      note.deal?.deletedAt === null
        ? {
            id: note.deal.id,
            title: note.deal.title,
          }
        : null,
    activity:
      note.activity?.deletedAt === null
        ? {
            id: note.activity.id,
            subject: note.activity.subject,
            type: note.activity.type,
          }
        : null,
  };
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async overview(userId: string) {
    const context = await this.tenantContextService.resolveForUser(userId);
    const tenantId = context.tenantId;
    const now = new Date();
    const todayEnd = endOfToday(now);
    const activeDealWhere = {
      tenantId,
      deletedAt: null,
    } satisfies Prisma.DealWhereInput;

    const [
      activeContactsCount,
      activeOrganizationsCount,
      activeDealsCount,
      notesCount,
      openActivitiesCount,
      completedActivitiesCount,
      overdueActivitiesCount,
      dueTodayActivitiesCount,
      upcomingActivitiesCount,
      dealStatusCounts,
      dealValueGroups,
      dealStageGroups,
      activeStages,
      recentDeals,
      recentActivities,
      recentNotes,
    ] = await Promise.all([
      this.prisma.person.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.organization.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.deal.count({ where: activeDealWhere }),
      this.prisma.note.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.activity.count({ where: { tenantId, deletedAt: null, completedAt: null } }),
      this.prisma.activity.count({
        where: { tenantId, deletedAt: null, completedAt: { not: null } },
      }),
      this.prisma.activity.count({
        where: { tenantId, deletedAt: null, completedAt: null, dueAt: { lt: now } },
      }),
      this.prisma.activity.count({
        where: {
          tenantId,
          deletedAt: null,
          completedAt: null,
          dueAt: { gte: now, lt: todayEnd },
        },
      }),
      this.prisma.activity.count({
        where: { tenantId, deletedAt: null, completedAt: null, dueAt: { gte: todayEnd } },
      }),
      this.prisma.deal.groupBy({
        by: ['status'],
        where: activeDealWhere,
        _count: { _all: true },
      }),
      this.prisma.deal.groupBy({
        by: ['status', 'currency'],
        where: activeDealWhere,
        _count: { _all: true },
        _sum: { value: true },
      }),
      this.prisma.deal.groupBy({
        by: ['stageId', 'currency'],
        where: activeDealWhere,
        _count: { _all: true },
        _sum: { value: true },
      }),
      this.prisma.stage.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, name: true, position: true },
      }),
      this.prisma.deal.findMany({
        where: activeDealWhere,
        select: recentDealSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: RECENT_LIMIT,
      }),
      this.prisma.activity.findMany({
        where: { tenantId, deletedAt: null },
        select: recentActivitySelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: RECENT_LIMIT,
      }),
      this.prisma.note.findMany({
        where: { tenantId, deletedAt: null },
        select: recentNoteSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: RECENT_LIMIT,
      }),
    ]);

    const statusCounts = new Map<DealStatus, number>(
      dealStatusCounts.map((group) => [group.status, group._count._all]),
    );
    const valuesByStatus = new Map<DealStatus, Map<string, Prisma.Decimal>>();
    const openPipelineValues = new Map<string, Prisma.Decimal>();
    const wonDealValues = new Map<string, Prisma.Decimal>();

    for (const group of dealValueGroups) {
      const statusValues = valuesByStatus.get(group.status) ?? new Map<string, Prisma.Decimal>();
      const value = group._sum.value ?? new Prisma.Decimal(0);
      mergeMoney(statusValues, group.currency, value);
      valuesByStatus.set(group.status, statusValues);

      if (group.status === DealStatus.OPEN) {
        mergeMoney(openPipelineValues, group.currency, value);
      }

      if (group.status === DealStatus.WON) {
        mergeMoney(wonDealValues, group.currency, value);
      }
    }

    const activeStageById = new Map(activeStages.map((stage) => [stage.id, stage]));
    const stageGroups = new Map<
      string,
      {
        count: number;
        totalValueByCurrency: Map<string, Prisma.Decimal>;
      }
    >();

    for (const group of dealStageGroups) {
      const current = stageGroups.get(group.stageId) ?? {
        count: 0,
        totalValueByCurrency: new Map<string, Prisma.Decimal>(),
      };
      current.count += group._count._all;
      mergeMoney(
        current.totalValueByCurrency,
        group.currency,
        group._sum.value ?? new Prisma.Decimal(0),
      );
      stageGroups.set(group.stageId, current);
    }

    return {
      summary: {
        activeContactsCount,
        activeOrganizationsCount,
        activeDealsCount,
        notesCount,
        openActivitiesCount,
        completedActivitiesCount,
        overdueActivitiesCount,
        dueTodayActivitiesCount,
        upcomingActivitiesCount,
        openDealsCount: statusCounts.get(DealStatus.OPEN) ?? 0,
        wonDealsCount: statusCounts.get(DealStatus.WON) ?? 0,
        lostDealsCount: statusCounts.get(DealStatus.LOST) ?? 0,
      },
      pipeline: {
        openPipelineValueByCurrency: moneyFromMap(openPipelineValues),
        wonDealValueByCurrency: moneyFromMap(wonDealValues),
        dealsByStatus: dealStatuses.map((status) => ({
          status,
          count: statusCounts.get(status) ?? 0,
          totalValueByCurrency: moneyFromMap(valuesByStatus.get(status) ?? new Map()),
        })),
        dealsByStage: [...stageGroups.entries()]
          .map(([stageId, group]) => {
            const stage = activeStageById.get(stageId);
            return {
              stageId,
              stageName: stage?.name ?? null,
              stagePosition: stage?.position ?? null,
              count: group.count,
              totalValueByCurrency: moneyFromMap(group.totalValueByCurrency),
            };
          })
          .sort((left, right) => {
            if (left.stagePosition === null && right.stagePosition === null) {
              return left.stageId.localeCompare(right.stageId);
            }

            if (left.stagePosition === null) {
              return 1;
            }

            if (right.stagePosition === null) {
              return -1;
            }

            return (
              left.stagePosition - right.stagePosition || left.stageId.localeCompare(right.stageId)
            );
          }),
      },
      recent: {
        deals: recentDeals.map(serializeDeal),
        activities: recentActivities.map(serializeActivity),
        notes: recentNotes.map(serializeNote),
      },
    };
  }
}
