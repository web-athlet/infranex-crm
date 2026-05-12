import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../shared/prisma/prisma.service';
import { TenantContextService } from '../../shared/tenant/tenant-context.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { ListContactsDto } from './dto/list-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const contactSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  title: true,
  notes: true,
  optIn: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
  organization: {
    select: {
      id: true,
      name: true,
      domain: true,
    },
  },
} satisfies Prisma.PersonSelect;

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

function normalizeEmail(value: string | null | undefined): string | null | undefined {
  const normalized = normalizeNullableString(value);
  return typeof normalized === 'string' ? normalized.toLowerCase() : normalized;
}

function pagination(query: ListContactsDto) {
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

function mapContactWriteError(error: unknown): never {
  if (isKnownPrismaError(error) && error.code === 'P2002') {
    throw new ConflictException('Contact email already exists for this tenant');
  }

  throw error;
}

async function assertOrganizationExists(
  client: Prisma.TransactionClient | PrismaService,
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

@Injectable()
export class ContactsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async list(userId: string, query: ListContactsDto) {
    const context = await this.tenantContextService.resolveForUser(userId);
    const { page, limit, skip } = pagination(query);
    const search = query.search?.trim();
    const organizationId = query.organizationId?.trim();
    const where: Prisma.PersonWhereInput = {
      tenantId: context.tenantId,
      deletedAt: null,
      ...(organizationId ? { organizationId } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { title: { contains: search, mode: 'insensitive' } },
              {
                organization: {
                  name: { contains: search, mode: 'insensitive' },
                  deletedAt: null,
                },
              },
              {
                organization: {
                  domain: { contains: search, mode: 'insensitive' },
                  deletedAt: null,
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.person.count({ where }),
      this.prisma.person.findMany({
        where,
        select: contactSelect,
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
    const contact = await this.prisma.person.findFirst({
      where: {
        id,
        tenantId: context.tenantId,
        deletedAt: null,
      },
      select: contactSelect,
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return contact;
  }

  async create(userId: string, dto: CreateContactDto) {
    const context = await this.tenantContextService.resolveForUser(userId);
    this.tenantContextService.assertCanWrite(context);
    const organizationId = normalizeNullableString(dto.organizationId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (organizationId) {
          await assertOrganizationExists(tx, context.tenantId, organizationId);
        }

        return tx.person.create({
          data: {
            tenantId: context.tenantId,
            firstName: normalizeRequiredString(dto.firstName),
            lastName: normalizeRequiredString(dto.lastName),
            email: normalizeEmail(dto.email),
            phone: normalizeNullableString(dto.phone),
            title: normalizeNullableString(dto.title),
            organizationId: organizationId ?? null,
            notes: normalizeNullableString(dto.notes),
            optIn: dto.optIn ?? false,
          },
          select: contactSelect,
        });
      });
    } catch (error: unknown) {
      mapContactWriteError(error);
    }
  }

  async update(userId: string, id: string, dto: UpdateContactDto) {
    const context = await this.tenantContextService.resolveForUser(userId);
    this.tenantContextService.assertCanWrite(context);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertContactExists(tx, context.tenantId, id);

        const organizationId = normalizeNullableString(dto.organizationId);

        if (organizationId) {
          await assertOrganizationExists(tx, context.tenantId, organizationId);
        }

        const updateResult = await tx.person.updateMany({
          where: {
            id,
            tenantId: context.tenantId,
            deletedAt: null,
          },
          data: {
            ...(dto.firstName !== undefined
              ? { firstName: normalizeRequiredString(dto.firstName) }
              : {}),
            ...(dto.lastName !== undefined
              ? { lastName: normalizeRequiredString(dto.lastName) }
              : {}),
            ...(dto.email !== undefined ? { email: normalizeEmail(dto.email) } : {}),
            ...(dto.phone !== undefined ? { phone: normalizeNullableString(dto.phone) } : {}),
            ...(dto.title !== undefined ? { title: normalizeNullableString(dto.title) } : {}),
            ...(dto.organizationId !== undefined ? { organizationId: organizationId ?? null } : {}),
            ...(dto.notes !== undefined ? { notes: normalizeNullableString(dto.notes) } : {}),
            ...(dto.optIn !== undefined ? { optIn: dto.optIn } : {}),
          },
        });

        if (updateResult.count === 0) {
          throw new NotFoundException('Contact not found');
        }

        const contact = await tx.person.findFirst({
          where: {
            id,
            tenantId: context.tenantId,
            deletedAt: null,
          },
          select: contactSelect,
        });

        if (!contact) {
          throw new NotFoundException('Contact not found');
        }

        return contact;
      });
    } catch (error: unknown) {
      mapContactWriteError(error);
    }
  }

  async remove(userId: string, id: string) {
    const context = await this.tenantContextService.resolveForUser(userId);
    this.tenantContextService.assertCanWrite(context);

    return this.prisma.$transaction(async (tx) => {
      await this.assertContactExists(tx, context.tenantId, id);

      return tx.person.update({
        where: {
          tenantId_id: {
            tenantId: context.tenantId,
            id,
          },
        },
        data: {
          deletedAt: new Date(),
          email: null,
        },
        select: contactSelect,
      });
    });
  }

  private async assertContactExists(
    client: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ): Promise<{ email: string | null }> {
    const contact = await client.person.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return contact;
  }
}
