import { Module } from '@nestjs/common';

import { AuthSharedModule } from '../../shared/guards/auth-shared.module';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { TenantContextModule } from '../../shared/tenant/tenant-context.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';

@Module({
  imports: [AuthSharedModule, PrismaModule, TenantContextModule],
  controllers: [DealsController],
  providers: [DealsService],
})
export class DealsModule {}
