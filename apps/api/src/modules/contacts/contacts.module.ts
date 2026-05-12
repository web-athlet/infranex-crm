import { Module } from '@nestjs/common';

import { AuthSharedModule } from '../../shared/guards/auth-shared.module';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { TenantContextModule } from '../../shared/tenant/tenant-context.module';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [AuthSharedModule, PrismaModule, TenantContextModule],
  controllers: [ContactsController],
  providers: [ContactsService],
})
export class ContactsModule {}
