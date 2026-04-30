import { SetMetadata } from '@nestjs/common';
import { MembershipRole } from '@prisma/client';

export const ROLES_KEY = 'auth:roles';

export type CrmRole = Extract<MembershipRole, 'ADMIN' | 'MANAGER' | 'SALES_REP' | 'READ_ONLY'>;

export function Roles(...roles: CrmRole[]) {
  return SetMetadata(ROLES_KEY, roles);
}
