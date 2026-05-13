import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../shared/prisma/prisma.service';
import { TenantContextService } from '../../shared/tenant/tenant-context.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { ListNotesDto } from './dto/list-notes.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_NOTE_TYPE = 'NOTE';

const noteSelect = {
  id: true,
  organizationId: true,
  personId: true,
  dealId: true,
  activityId: true,
  authorId: true,
  type: true,
  title: true,
  content: true,
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
  activity: {
    select: {
      id: true,
      subject: true,
      type: true,
      deletedAt: true,
    },
  },
} satisfies Prisma.NoteSelect;

type PrismaClientLike = Prisma.TransactionClient | PrismaService;
type SelectedNote = Prisma.NoteGetPayload<{ select: typeof noteSelect }>;
type SelectedNoteOrganization = NonNullable<SelectedNote['organization']>;
type SelectedNotePerson = NonNullable<SelectedNote['person']>;
type SelectedNoteDeal = NonNullable<SelectedNote['deal']>;
type SelectedNoteActivity = NonNullable<SelectedNote['activity']>;
type NoteResponse = Omit<SelectedNote, 'organization' | 'person' | 'deal' | 'activity'> & {
  organization: Omit<SelectedNoteOrganization, 'deletedAt'> | null;
  person: Omit<SelectedNotePerson, 'deletedAt'> | null;
  deal: Omit<SelectedNoteDeal, 'deletedAt'> | null;
  activity: Omit<SelectedNoteActivity, 'deletedAt'> | null;
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

function normalizeType(value: string | undefined): string | undefined {
  return value?.trim().toUpperCase();
}

function pagination(query: ListNotesDto) {
  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function serializeNote(note: SelectedNote): NoteResponse {
  const { organization, person, deal, activity, ...rest } = note;

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
    activity:
      activity?.deletedAt === null
        ? {
            id: activity.id,
            subject: activity.subject,
            type: activity.type,
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

async function assertActivityExists(
  client: PrismaClientLike,
  tenantId: string,
  activityId: string,
): Promise<void> {
  const activity = await client.activity.findFirst({
    where: {
      id: activityId,
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

@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async list(userId: string, query: ListNotesDto) {
    const context = await this.tenantContextService.resolveForUser(userId);
    const { page, limit, skip } = pagination(query);
    const search = query.search?.trim();
    const type = normalizeType(query.type);

    const where: Prisma.NoteWhereInput = {
      tenantId: context.tenantId,
      deletedAt: null,
      ...(type ? { type } : {}),
      ...(query.organizationId ? { organizationId: query.organizationId.trim() } : {}),
      ...(query.personId ? { personId: query.personId.trim() } : {}),
      ...(query.dealId ? { dealId: query.dealId.trim() } : {}),
      ...(query.activityId ? { activityId: query.activityId.trim() } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { content: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.note.count({ where }),
      this.prisma.note.findMany({
        where,
        select: noteSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: items.map(serializeNote),
      page,
      limit,
      total,
    };
  }

  async get(userId: string, id: string) {
    const context = await this.tenantContextService.resolveForUser(userId);
    const note = await this.prisma.note.findFirst({
      where: {
        id,
        tenantId: context.tenantId,
        deletedAt: null,
      },
      select: noteSelect,
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return serializeNote(note);
  }

  async create(userId: string, dto: CreateNoteDto) {
    const context = await this.tenantContextService.resolveForUser(userId);
    this.tenantContextService.assertCanWrite(context);

    return this.prisma.$transaction(async (tx) => {
      const organizationId = normalizeNullableString(dto.organizationId);
      const personId = normalizeNullableString(dto.personId);
      const dealId = normalizeNullableString(dto.dealId);
      const activityId = normalizeNullableString(dto.activityId);

      await this.assertRelationTargets(tx, context.tenantId, {
        organizationId,
        personId,
        dealId,
        activityId,
      });

      const note = await tx.note.create({
        data: {
          tenantId: context.tenantId,
          authorId: context.membershipId,
          type: normalizeType(dto.type) ?? DEFAULT_NOTE_TYPE,
          title: normalizeNullableString(dto.title),
          content: normalizeRequiredString(dto.content),
          organizationId: organizationId ?? null,
          personId: personId ?? null,
          dealId: dealId ?? null,
          activityId: activityId ?? null,
        },
        select: noteSelect,
      });

      return serializeNote(note);
    });
  }

  async update(userId: string, id: string, dto: UpdateNoteDto) {
    const context = await this.tenantContextService.resolveForUser(userId);
    this.tenantContextService.assertCanWrite(context);

    return this.prisma.$transaction(async (tx) => {
      await this.assertNoteExists(tx, context.tenantId, id);

      const organizationId = normalizeNullableString(dto.organizationId);
      const personId = normalizeNullableString(dto.personId);
      const dealId = normalizeNullableString(dto.dealId);
      const activityId = normalizeNullableString(dto.activityId);

      await this.assertRelationTargets(tx, context.tenantId, {
        organizationId,
        personId,
        dealId,
        activityId,
      });

      const updateResult = await tx.note.updateMany({
        where: {
          id,
          tenantId: context.tenantId,
          deletedAt: null,
        },
        data: {
          ...(dto.title !== undefined ? { title: normalizeNullableString(dto.title) } : {}),
          ...(dto.content !== undefined ? { content: normalizeRequiredString(dto.content) } : {}),
          ...(dto.type !== undefined ? { type: normalizeType(dto.type) } : {}),
          ...(dto.organizationId !== undefined ? { organizationId: organizationId ?? null } : {}),
          ...(dto.personId !== undefined ? { personId: personId ?? null } : {}),
          ...(dto.dealId !== undefined ? { dealId: dealId ?? null } : {}),
          ...(dto.activityId !== undefined ? { activityId: activityId ?? null } : {}),
        },
      });

      if (updateResult.count === 0) {
        throw new NotFoundException('Note not found');
      }

      return this.findActiveNote(tx, context.tenantId, id);
    });
  }

  async remove(userId: string, id: string) {
    const context = await this.tenantContextService.resolveForUser(userId);
    this.tenantContextService.assertCanWrite(context);

    return this.prisma.$transaction(async (tx) => {
      await this.assertNoteExists(tx, context.tenantId, id);
      const note = await tx.note.updateMany({
        where: {
          id,
          tenantId: context.tenantId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      if (note.count === 0) {
        throw new NotFoundException('Note not found');
      }

      const deletedNote = await tx.note.findFirst({
        where: {
          id,
          tenantId: context.tenantId,
        },
        select: noteSelect,
      });

      if (!deletedNote) {
        throw new NotFoundException('Note not found');
      }

      return serializeNote(deletedNote);
    });
  }

  private async assertRelationTargets(
    client: PrismaClientLike,
    tenantId: string,
    relationIds: {
      organizationId: string | null | undefined;
      personId: string | null | undefined;
      dealId: string | null | undefined;
      activityId: string | null | undefined;
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

    if (relationIds.activityId) {
      await assertActivityExists(client, tenantId, relationIds.activityId);
    }
  }

  private async assertNoteExists(
    client: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ): Promise<void> {
    const note = await client.note.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }
  }

  private async findActiveNote(client: Prisma.TransactionClient, tenantId: string, id: string) {
    const note = await client.note.findFirst({
      where: {
        id,
        tenantId,
        deletedAt: null,
      },
      select: noteSelect,
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    return serializeNote(note);
  }
}
