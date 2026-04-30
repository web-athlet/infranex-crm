import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MembershipRole } from '@prisma/client';

import { AuthService } from '../auth.service';
import { CrmRole, ROLES_KEY } from '../decorators/roles.decorator';

const CRM_ROLE_RANK: Record<CrmRole, number> = {
  ADMIN: 4,
  MANAGER: 3,
  SALES_REP: 2,
  READ_ONLY: 1,
};

type TenantContext = {
  tenantId: string;
};

type AuthenticatedIdentity = {
  id?: unknown;
  userId?: unknown;
};

type RequestWithAuthContext = {
  user?: AuthenticatedIdentity;
  tenantContext?: TenantContext;
};

function isCrmRole(role: MembershipRole): role is CrmRole {
  return role === 'ADMIN' || role === 'MANAGER' || role === 'SALES_REP' || role === 'READ_ONLY';
}

function hasRequiredRole(actualRole: MembershipRole, requiredRoles: CrmRole[]): boolean {
  if (!isCrmRole(actualRole)) {
    return false;
  }

  const actualRank = CRM_ROLE_RANK[actualRole];

  return requiredRoles.some((requiredRole) => actualRank >= CRM_ROLE_RANK[requiredRole]);
}

function hasTenantContext(value: TenantContext | undefined): value is TenantContext {
  return typeof value?.tenantId === 'string' && value.tenantId.length > 0;
}

function getAuthenticatedUserId(user: AuthenticatedIdentity | undefined): string | null {
  if (typeof user?.id === 'string' && user.id.length > 0) {
    return user.id;
  }

  if (typeof user?.userId === 'string' && user.userId.length > 0) {
    return user.userId;
  }

  return null;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<CrmRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuthContext>();

    const userId = getAuthenticatedUserId(request.user);

    if (!userId) {
      throw new ForbiddenException('Tenant role is required');
    }

    // TODO: Populate tenantContext only from a server-side tenant resolver before using this guard.
    if (!hasTenantContext(request.tenantContext)) {
      throw new ForbiddenException('Tenant context is required');
    }

    const role = await this.authService.getActiveTenantMembershipRole(
      userId,
      request.tenantContext.tenantId,
    );

    if (!role || !hasRequiredRole(role, requiredRoles)) {
      throw new ForbiddenException('Insufficient tenant role');
    }

    return true;
  }
}
