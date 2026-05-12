import { ForbiddenException, Injectable } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export type TenantContext = {
  tenantId: string;
  membershipId: string;
  role: MembershipRole;
};

const WRITE_ROLES = new Set<MembershipRole>(['OWNER', 'ADMIN', 'MANAGER', 'SALES_REP']);

@Injectable()
export class TenantContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForUser(userId: string): Promise<TenantContext> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        isActive: true,
        deletedAt: null,
        tenant: {
          deletedAt: null,
        },
        user: {
          deletedAt: null,
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        tenantId: true,
        role: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Active tenant membership is required');
    }

    // Known limitation: until the tenant switcher exists, CRM requests use the first active membership deterministically.
    return {
      tenantId: membership.tenantId,
      membershipId: membership.id,
      role: membership.role,
    };
  }

  assertCanWrite(context: TenantContext): void {
    if (!WRITE_ROLES.has(context.role)) {
      throw new ForbiddenException('Tenant write role is required');
    }
  }
}
