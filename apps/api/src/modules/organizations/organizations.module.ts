import { Module } from '@nestjs/common';

import { AuthSharedModule } from '../../shared/guards/auth-shared.module';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { TenantContextModule } from '../../shared/tenant/tenant-context.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [AuthSharedModule, PrismaModule, TenantContextModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
