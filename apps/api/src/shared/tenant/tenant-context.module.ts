import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { TenantContextService } from './tenant-context.service';

@Module({
  imports: [PrismaModule],
  providers: [TenantContextService],
  exports: [TenantContextService],
})
export class TenantContextModule {}
