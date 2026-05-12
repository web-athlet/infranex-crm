import { Injectable, NotFoundException } from '@nestjs/common';
import { DealStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../shared/prisma/prisma.service';
import { TenantContextService } from '../../shared/tenant/tenant-context.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { ListDealsDto } from './dto/list-deals.dto';
import { UpdateDealDto } from './dto/update-deal.dto';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_PIPELINE_NAME = 'Vertriebs-Pipeline';
const DEFAULT_STAGE_NAMES = [
  'Qualifiziert',
  'Demo geplant',
  'Demo abgeschlossen',
  'Angebot abgegeben',
  'Verhandlungen',
  'Vertrag unterschrieben',
] as const;

const dealSelect = {
  id: true,
  organizationId: true,
  personId: true,
  pipelineId: true,
  stageId: true,
  ownerId: true,
  title: true,
  description: true,
  value: true,
  currency: true,
  status: true,
  expectedCloseAt: true,
  closedAt: true,
  lostReason: true,
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
  stage: {
    select: {
      id: true,
      name: true,
      position: true,
      probability: true,
    },
  },
} satisfies Prisma.DealSelect;

const pipelineSelect = {
  id: true,
  name: true,
  stages: {
    where: {
      deletedAt: null,
    },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      position: true,
      probability: true,
    },
  },
} satisfies Prisma.PipelineSelect;

type PrismaClientLike = Prisma.TransactionClient | PrismaService;
type SelectedDeal = Prisma.DealGetPayload<{ select: typeof dealSelect }>;
type SelectedDealOrganization = NonNullable<SelectedDeal['organization']>;
type SelectedDealPerson = NonNullable<SelectedDeal['person']>;
type DealResponse = Omit<SelectedDeal, 'organization' | 'person'> & {
  organization: Omit<SelectedDealOrganization, 'deletedAt'> | null;
  person: Omit<SelectedDealPerson, 'deletedAt'> | null;
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

function pagination(query: ListDealsDto) {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function serializeDeal(deal: SelectedDeal): DealResponse {
  const { organization, person, ...rest } = deal;

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

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async list(userId: string, query: ListDealsDto) {
    const context = await this.tenantContextService.resolveForUser(userId);
    const { page, limit, skip } = pagination(query);
    const search = query.search?.trim();
    const stageId = query.stageId?.trim();
    const where: Prisma.DealWhereInput = {
      tenantId: context.tenantId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(stageId ? { stageId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { currency: { contains: search, mode: 'insensitive' } },
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
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.deal.count({ where }),
      this.prisma.deal.findMany({
        where,
        select: dealSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: items.map(serializeDeal),
      page,
      limit,
      total,
    };
  }

  async get(userId: string, id: string) {
    const context = await this.tenantContextService.resolveForUser(userId);
    const deal = await this.prisma.deal.findFirst({
      where: {
        id,
        tenantId: context.tenantId,
        deletedAt: null,
      },
      select: dealSelect,
    });

    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    return serializeDeal(deal);
  }

  async getDefaultPipeline(userId: string) {
    const context = await this.tenantContextService.resolveForUser(userId);
    const pipeline = await this.prisma.pipeline.findFirst({
      where: {
        tenantId: context.tenantId,
        isDefault: true,
        deletedAt: null,
      },
      select: pipelineSelect,
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    return pipeline;
  }

  async create(userId: string, dto: CreateDealDto) {
    const context = await this.tenantContextService.resolveForUser(userId);
    this.tenantContextService.assertCanWrite(context);

    return this.prisma.$transaction(async (tx) => {
      const organizationId = normalizeNullableString(dto.organizationId);
      const personId = normalizeNullableString(dto.personId);
      const pipeline = await this.ensureDefaultPipeline(tx, context.tenantId);
      const stage = dto.stageId
        ? await this.assertDefaultStageExists(tx, context.tenantId, pipeline.id, dto.stageId)
        : pipeline.stages[0];

      if (!stage) {
        throw new NotFoundException('Pipeline stage not found');
      }

      if (organizationId) {
        await assertOrganizationExists(tx, context.tenantId, organizationId);
      }

      if (personId) {
        await assertPersonExists(tx, context.tenantId, personId);
      }

      const deal = await tx.deal.create({
        data: {
          tenantId: context.tenantId,
          ownerId: context.membershipId,
          pipelineId: pipeline.id,
          stageId: stage.id,
          title: normalizeRequiredString(dto.title),
          description: normalizeNullableString(dto.description),
          value: dto.value !== undefined ? new Prisma.Decimal(dto.value) : undefined,
          currency: dto.currency ?? 'EUR',
          status: dto.status ?? DealStatus.OPEN,
          organizationId: organizationId ?? null,
          personId: personId ?? null,
          expectedCloseAt: normalizeDate(dto.expectedCloseAt),
          lostReason: normalizeNullableString(dto.lostReason),
        },
        select: dealSelect,
      });

      return serializeDeal(deal);
    });
  }

  async update(userId: string, id: string, dto: UpdateDealDto) {
    const context = await this.tenantContextService.resolveForUser(userId);
    this.tenantContextService.assertCanWrite(context);

    return this.prisma.$transaction(async (tx) => {
      const existingDeal = await this.assertDealExists(tx, context.tenantId, id);
      const organizationId = normalizeNullableString(dto.organizationId);
      const personId = normalizeNullableString(dto.personId);
      const stage = dto.stageId
        ? await this.assertDefaultStageExists(
            tx,
            context.tenantId,
            existingDeal.pipelineId,
            dto.stageId,
          )
        : undefined;

      if (organizationId) {
        await assertOrganizationExists(tx, context.tenantId, organizationId);
      }

      if (personId) {
        await assertPersonExists(tx, context.tenantId, personId);
      }

      const updateResult = await tx.deal.updateMany({
        where: {
          id,
          tenantId: context.tenantId,
          deletedAt: null,
        },
        data: {
          ...(dto.title !== undefined ? { title: normalizeRequiredString(dto.title) } : {}),
          ...(dto.description !== undefined
            ? { description: normalizeNullableString(dto.description) }
            : {}),
          ...(dto.value !== undefined ? { value: new Prisma.Decimal(dto.value) } : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(stage ? { stageId: stage.id } : {}),
          ...(dto.organizationId !== undefined ? { organizationId: organizationId ?? null } : {}),
          ...(dto.personId !== undefined ? { personId: personId ?? null } : {}),
          ...(dto.expectedCloseAt !== undefined
            ? { expectedCloseAt: normalizeDate(dto.expectedCloseAt) }
            : {}),
          ...(dto.lostReason !== undefined
            ? { lostReason: normalizeNullableString(dto.lostReason) }
            : {}),
        },
      });

      if (updateResult.count === 0) {
        throw new NotFoundException('Deal not found');
      }

      const deal = await tx.deal.findFirst({
        where: {
          id,
          tenantId: context.tenantId,
          deletedAt: null,
        },
        select: dealSelect,
      });

      if (!deal) {
        throw new NotFoundException('Deal not found');
      }

      return serializeDeal(deal);
    });
  }

  async remove(userId: string, id: string) {
    const context = await this.tenantContextService.resolveForUser(userId);
    this.tenantContextService.assertCanWrite(context);

    return this.prisma.$transaction(async (tx) => {
      await this.assertDealExists(tx, context.tenantId, id);

      const deal = await tx.deal.update({
        where: {
          tenantId_id: {
            tenantId: context.tenantId,
            id,
          },
        },
        data: {
          deletedAt: new Date(),
        },
        select: dealSelect,
      });

      return serializeDeal(deal);
    });
  }

  private async ensureDefaultPipeline(client: PrismaClientLike, tenantId: string) {
    const pipeline = await client.pipeline.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: DEFAULT_PIPELINE_NAME,
        },
      },
      update: {
        isDefault: true,
        deletedAt: null,
      },
      create: {
        tenantId,
        name: DEFAULT_PIPELINE_NAME,
        isDefault: true,
      },
      select: {
        id: true,
      },
    });

    for (const [index, name] of DEFAULT_STAGE_NAMES.entries()) {
      const position = index + 1;
      await client.stage.upsert({
        where: {
          tenantId_pipelineId_name: {
            tenantId,
            pipelineId: pipeline.id,
            name,
          },
        },
        update: {
          position,
          probability: position * 15,
          deletedAt: null,
        },
        create: {
          tenantId,
          pipelineId: pipeline.id,
          name,
          position,
          probability: position * 15,
        },
        select: {
          id: true,
        },
      });
    }

    const activePipeline = await client.pipeline.findFirst({
      where: {
        id: pipeline.id,
        tenantId,
        deletedAt: null,
      },
      select: pipelineSelect,
    });

    if (!activePipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    return activePipeline;
  }

  private async assertDefaultStageExists(
    client: PrismaClientLike,
    tenantId: string,
    pipelineId: string,
    stageId: string,
  ) {
    const stage = await client.stage.findFirst({
      where: {
        id: stageId,
        tenantId,
        pipelineId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        position: true,
        probability: true,
      },
    });

    if (!stage) {
      throw new NotFoundException('Pipeline stage not found');
    }

    return stage;
  }

  private async assertDealExists(client: Prisma.TransactionClient, tenantId: string, id: string) {
    const deal = await client.deal.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        pipelineId: true,
      },
    });

    if (!deal) {
      throw new NotFoundException('Deal not found');
    }

    return deal;
  }
}
