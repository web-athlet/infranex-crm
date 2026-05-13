import { Module } from '@nestjs/common';

import { AuthSharedModule } from '../../shared/guards/auth-shared.module';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { TenantContextModule } from '../../shared/tenant/tenant-context.module';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  imports: [AuthSharedModule, PrismaModule, TenantContextModule],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
