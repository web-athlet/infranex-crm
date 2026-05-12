import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../shared/prisma/prisma.service';
import { TenantContextService } from '../../shared/tenant/tenant-context.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { ListOrganizationsDto } from './dto/list-organizations.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const organizationSelect = {
  id: true,
  name: true,
  website: true,
  domain: true,
  industry: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      people: {
        where: {
          deletedAt: null,
        },
      },
    },
  },
} satisfies Prisma.OrganizationSelect;

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

function normalizeDomain(value: string | null | undefined): string | null | undefined {
  const normalized = normalizeNullableString(value);
  return typeof normalized === 'string' ? normalized.toLowerCase() : normalized;
}

function pagination(query: ListOrganizationsDto) {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function mapOrganizationWriteError(error: unknown): never {
  if (isKnownPrismaError(error) && error.code === 'P2002') {
    throw new ConflictException('Organization domain already exists for this tenant');
  }

  throw error;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async list(userId: string, query: ListOrganizationsDto) {
    const context = await this.tenantContextService.resolveForUser(userId);
    const { page, limit, skip } = pagination(query);
    const search = query.search?.trim();
    const where: Prisma.OrganizationWhereInput = {
      tenantId: context.tenantId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { domain: { contains: search, mode: 'insensitive' } },
              { website: { contains: search, mode: 'insensitive' } },
              { industry: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        select: organizationSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      page,
      limit,
      total,
    };
  }

  async get(userId: string, id: string) {
    const context = await this.tenantContextService.resolveForUser(userId);
    const organization = await this.prisma.organization.findFirst({
      where: {
        id,
        tenantId: context.tenantId,
        deletedAt: null,
      },
      select: organizationSelect,
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async create(userId: string, dto: CreateOrganizationDto) {
    const context = await this.tenantContextService.resolveForUser(userId);
    this.tenantContextService.assertCanWrite(context);

    try {
      return await this.prisma.organization.create({
        data: {
          tenantId: context.tenantId,
          name: normalizeRequiredString(dto.name),
          website: normalizeNullableString(dto.website),
          domain: normalizeDomain(dto.domain),
          industry: normalizeNullableString(dto.industry),
          notes: normalizeNullableString(dto.notes),
        },
        select: organizationSelect,
      });
    } catch (error: unknown) {
      mapOrganizationWriteError(error);
    }
  }

  async update(userId: string, id: string, dto: UpdateOrganizationDto) {
    const context = await this.tenantContextService.resolveForUser(userId);
    this.tenantContextService.assertCanWrite(context);

    await this.assertOrganizationExists(context.tenantId, id);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updateResult = await tx.organization.updateMany({
          where: {
            id,
            tenantId: context.tenantId,
            deletedAt: null,
          },
          data: {
            ...(dto.name !== undefined ? { name: normalizeRequiredString(dto.name) } : {}),
            ...(dto.website !== undefined ? { website: normalizeNullableString(dto.website) } : {}),
            ...(dto.domain !== undefined ? { domain: normalizeDomain(dto.domain) } : {}),
            ...(dto.industry !== undefined
              ? { industry: normalizeNullableString(dto.industry) }
              : {}),
            ...(dto.notes !== undefined ? { notes: normalizeNullableString(dto.notes) } : {}),
          },
        });

        if (updateResult.count === 0) {
          throw new NotFoundException('Organization not found');
        }

        const organization = await tx.organization.findFirst({
          where: {
            id,
            tenantId: context.tenantId,
            deletedAt: null,
          },
          select: organizationSelect,
        });

        if (!organization) {
          throw new NotFoundException('Organization not found');
        }

        return organization;
      });
    } catch (error: unknown) {
      mapOrganizationWriteError(error);
    }
  }

  async remove(userId: string, id: string) {
    const context = await this.tenantContextService.resolveForUser(userId);
    this.tenantContextService.assertCanWrite(context);

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findFirst({
        where: {
          id,
          tenantId: context.tenantId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }

      await tx.person.updateMany({
        where: {
          tenantId: context.tenantId,
          organizationId: id,
          deletedAt: null,
        },
        data: {
          organizationId: null,
        },
      });

      return tx.organization.update({
        where: {
          tenantId_id: {
            tenantId: context.tenantId,
            id,
          },
        },
        data: {
          deletedAt: new Date(),
          domain: null,
        },
        select: organizationSelect,
      });
    });
  }

  private async assertOrganizationExists(tenantId: string, id: string): Promise<void> {
    const organization = await this.prisma.organization.findFirst({
      where: {
        id,
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
}
