import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, Prisma, Priority } from '@prisma/client';

import { PrismaService } from '../../shared/prisma/prisma.service';
import { TenantContextService } from '../../shared/tenant/tenant-context.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import {
  ActivityCompletionFilter,
  ActivityDueFilter,
  ListActivitiesDto,
} from './dto/list-activities.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const activitySelect = {
  id: true,
  organizationId: true,
  personId: true,
  dealId: true,
  ownerId: true,
  type: true,
  priority: true,
  subject: true,
  body: true,
  dueAt: true,
  completedAt: true,
  createdAt: true,
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

type PrismaClientLike = Prisma.TransactionClient | PrismaService;
type SelectedActivity = Prisma.ActivityGetPayload<{ select: typeof activitySelect }>;
type SelectedActivityOrganization = NonNullable<SelectedActivity['organization']>;
type SelectedActivityPerson = NonNullable<SelectedActivity['person']>;
type SelectedActivityDeal = NonNullable<SelectedActivity['deal']>;
type ActivityResponse = Omit<SelectedActivity, 'organization' | 'person' | 'deal'> & {
  organization: Omit<SelectedActivityOrganization, 'deletedAt'> | null;
  person: Omit<SelectedActivityPerson, 'deletedAt'> | null;
  deal: Omit<SelectedActivityDeal, 'deletedAt'> | null;
};

function normalizeNullableString(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredString(value: string): string {
  return value.trim();
}

function normalizeDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value === null ? null : new Date(value);
}

function pagination(query: ListActivitiesDto) {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function todayBounds(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

function completionWhere(
  completion: ActivityCompletionFilter | undefined,
): Prisma.ActivityWhereInput {
  if (completion === ActivityCompletionFilter.OPEN) {
    return { completedAt: null };
  }

  if (completion === ActivityCompletionFilter.COMPLETED) {
    return { completedAt: { not: null } };
  }

  return {};
}

function dueWhere(
  due: ActivityDueFilter | undefined,
  completion: ActivityCompletionFilter | undefined,
): Prisma.ActivityWhereInput {
  if (!due) {
    return {};
  }

  const { start, end } = todayBounds();

  if (due === ActivityDueFilter.OVERDUE) {
    return {
      dueAt: { lt: start },
      ...(completion === undefined ? { completedAt: null } : {}),
    };
  }

  if (due === ActivityDueFilter.TODAY) {
    return { dueAt: { gte: start, lt: end } };
  }

  if (due === ActivityDueFilter.UPCOMING) {
    return { dueAt: { gte: end } };
  }

  return { dueAt: null };
}

function serializeActivity(activity: SelectedActivity): ActivityResponse {
  const { organization, person, deal, ...rest } = activity;

  return {
    ...rest,
    organization:
      organization?.deletedAt === null
        ? {
            id: organization.id,
            name: organization.name,
            domain: organization.domain,
          }
        : null,
    person:
      person?.deletedAt === null
        ? {
            id: person.id,
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.email,
          }
        : null,
    deal:
      deal?.deletedAt === null
        ? {
            id: deal.id,
            title: deal.title,
          }
        : null,
  };
}

async function assertOrganizationExists(
  client: PrismaClientLike,
  tenantId: string,
  organizationId: string,
): Promise<void> {
  const organization = await client.organization.findFirst({
    where: {
      id: organizationId,
      tenantId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!organization) {
    throw new NotFoundException('Organization not found');
  }
}

async function assertPersonExists(
  client: PrismaClientLike,
  tenantId: string,
  personId: string,
): Promise<void> {
  const person = await client.person.findFirst({
    where: {
      id: personId,
      tenantId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!person) {
    throw new NotFoundException('Contact not found');
  }
}

async function assertDealExists(
  client: PrismaClientLike,
  tenantId: string,
  dealId: string,
): Promise<void> {
  const deal = await client.deal.findFirst({
    where: {
      id: dealId,
      tenantId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!deal) {
    throw new NotFoundException('Deal not found');
  }
}

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async list(userId: string, query: ListActivitiesDto) {
    const context = await this.tenantContextService.resolveForUser(userId);
    const { page, limit, skip } = pagination(query);
    const search = query.search?.trim();

    if (
      query.completion === ActivityCompletionFilter.COMPLETED &&
      query.due === ActivityDueFilter.OVERDUE
    ) {
      return {
        items: [],
        page,
        limit,
        total: 0,
      };
    }

    const where: Prisma.ActivityWhereInput = {
      tenantId: context.tenantId,
      deletedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.organizationId ? { organizationId: query.organizationId.trim() } : {}),
      ...(query.personId ? { personId: query.personId.trim() } : {}),
      ...(query.dealId ? { dealId: query.dealId.trim() } : {}),
      ...completionWhere(query.completion),
      ...dueWhere(query.due, query.completion),
      ...(search
        ? {
            OR: [
              { subject: { contains: search, mode: 'insensitive' } },
              { body: { contains: search, mode: 'insensitive' } },
              {
                organization: {
                  name: { contains: search, mode: 'insensitive' },
                  deletedAt: null,
                },
              },
              {
                person: {
                  firstName: { contains: search, mode: 'insensitive' },
                  deletedAt: null,
                },
              },
              {
                person: {
                  lastName: { contains: search, mode: 'insensitive' },
                  deletedAt: null,
                },
              },
              {
                deal: {
                  title: { contains: search, mode: 'insensitive' },
                  deletedAt: null,
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.activity.count({ where }),
      this.prisma.activity.findMany({
        where,
        select: activitySelect,
        orderBy: [{ dueAt: 'asc' }, { updatedAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: items.map(serializeActivity),
      page,
      limit,
      total,
    };
  }

  async get(userId: string, id: string) {
    const context = await this.tenantContextService.resolveForUser(userId);
    const activity = await this.prisma.activity.findFirst({
      where: {
        id,
        tenantId: context.tenantId,
        deletedAt: null,
      },
      select: activitySelect,
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    return serializeActivity(activity);
  }

  async create(userId: string, dto: CreateActivityDto) {
    const context = await this.tenantContextService.resolveForUser(userId);
    this.tenantContextService.assertCanWrite(context);

    return this.prisma.$transaction(async (tx) => {
      const organizationId = normalizeNullableString(dto.organizationId);
      const personId = normalizeNullableString(dto.personId);
      const dealId = normalizeNullableString(dto.dealId);

      await this.assertRelationTargets(tx, context.tenantId, {
        organizationId,
        personId,
        dealId,
      });

      const activity = await tx.activity.create({
        data: {
          tenantId: context.tenantId,
          ownerId: context.membershipId,
          subject: normalizeRequiredString(dto.subject),
          body: normalizeNullableString(dto.body),
          type: dto.type ?? ActivityType.TASK,
          priority: dto.priority ?? Priority.MEDIUM,
          dueAt: normalizeDate(dto.dueAt),
          organizationId: organizationId ?? null,
          personId: personId ?? null,
          dealId: dealId ?? null,
        },
        select: activitySelect,
      });

      return serializeActivity(activity);
    });
  }

  async update(userId: string, id: string, dto: UpdateActivityDto) {
    const context = await this.tenantContextService.resolveForUser(userId);
    this.tenantContextService.assertCanWrite(context);

    return this.prisma.$transaction(async (tx) => {
      await this.assertActivityExists(tx, context.tenantId, id);

      const organizationId = normalizeNullableString(dto.organizationId);
      const personId = normalizeNullableString(dto.personId);
      const dealId = normalizeNullableString(dto.dealId);

      await this.assertRelationTargets(tx, context.tenantId, {
        organizationId,
        personId,
        dealId,
      });

      const updateResult = await tx.activity.updateMany({
        where: {
          id,
          tenantId: context.tenantId,
          deletedAt: null,
        },
        data: {
          ...(dto.subject !== undefined ? { subject: normalizeRequiredString(dto.subject) } : {}),
          ...(dto.body !== undefined ? { body: normalizeNullableString(dto.body) } : {}),
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.dueAt !== undefined ? { dueAt: normalizeDate(dto.dueAt) } : {}),
          ...(dto.organizationId !== undefined ? { organizationId: organizationId ?? null } : {}),
          ...(dto.personId !== undefined ? { personId: personId ?? null } : {}),
          ...(dto.dealId !== undefined ? { dealId: dealId ?? null } : {}),
        },
      });

      if (updateResult.count === 0) {
        throw new NotFoundException('Activity not found');
      }

      return this.findActiveActivity(tx, context.tenantId, id);
    });
  }

  async complete(userId: string, id: string) {
    const context = await this.tenantContextService.resolveForUser(userId);
    this.tenantContextService.assertCanWrite(context);

    return this.prisma.$transaction(async (tx) => {
      await this.assertActivityExists(tx, context.tenantId, id);
      const updateResult = await tx.activity.updateMany({
        where: {
          id,
          tenantId: context.tenantId,
          deletedAt: null,
        },
        data: {
          completedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new NotFoundException('Activity not found');
      }

      return this.findActiveActivity(tx, context.tenantId, id);
    });
  }

  async reopen(userId: string, id: string) {
    const context = await this.tenantContextService.resolveForUser(userId);
    this.tenantContextService.assertCanWrite(context);

    return this.prisma.$transaction(async (tx) => {
      await this.assertActivityExists(tx, context.tenantId, id);
      const updateResult = await tx.activity.updateMany({
        where: {
          id,
          tenantId: context.tenantId,
          deletedAt: null,
        },
        data: {
          completedAt: null,
        },
      });

      if (updateResult.count === 0) {
        throw new NotFoundException('Activity not found');
      }

      return this.findActiveActivity(tx, context.tenantId, id);
    });
  }

  async remove(userId: string, id: string) {
    const context = await this.tenantContextService.resolveForUser(userId);
    this.tenantContextService.assertCanWrite(context);

    return this.prisma.$transaction(async (tx) => {
      await this.assertActivityExists(tx, context.tenantId, id);
      const activity = await tx.activity.updateMany({
        where: {
          id,
          tenantId: context.tenantId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      if (activity.count === 0) {
        throw new NotFoundException('Activity not found');
      }

      const deletedActivity = await tx.activity.findFirst({
        where: {
          id,
          tenantId: context.tenantId,
        },
        select: activitySelect,
      });

      if (!deletedActivity) {
        throw new NotFoundException('Activity not found');
      }

      return serializeActivity(deletedActivity);
    });
  }

  private async assertRelationTargets(
    client: PrismaClientLike,
    tenantId: string,
    relationIds: {
      organizationId: string | null | undefined;
      personId: string | null | undefined;
      dealId: string | null | undefined;
    },
  ): Promise<void> {
    if (relationIds.organizationId) {
      await assertOrganizationExists(client, tenantId, relationIds.organizationId);
    }

    if (relationIds.personId) {
      await assertPersonExists(client, tenantId, relationIds.personId);
    }

    if (relationIds.dealId) {
      await assertDealExists(client, tenantId, relationIds.dealId);
    }
  }

  private async assertActivityExists(
    client: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ): Promise<void> {
    const activity = await client.activity.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }
  }

  private async findActiveActivity(client: Prisma.TransactionClient, tenantId: string, id: string) {
    const activity = await client.activity.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      select: activitySelect,
    });

    if (!activity) {
      throw new NotFoundException('Activity not found');
    }

    return serializeActivity(activity);
  }
}
