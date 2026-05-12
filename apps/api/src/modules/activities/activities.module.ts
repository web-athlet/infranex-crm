import { Module } from '@nestjs/common';

import { AuthSharedModule } from '../../shared/guards/auth-shared.module';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { TenantContextModule } from '../../shared/tenant/tenant-context.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';

@Module({
  imports: [AuthSharedModule, PrismaModule, TenantContextModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
})
export class ActivitiesModule {}
