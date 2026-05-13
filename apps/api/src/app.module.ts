import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { HealthController } from './health.controller';
import { ActivitiesModule } from './modules/activities/activities.module';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { DealsModule } from './modules/deals/deals.module';
import { EmailsModule } from './modules/emails/emails.module';
import { InsightsModule } from './modules/insights/insights.module';
import { LeadsModule } from './modules/leads/leads.module';
import { NotesModule } from './modules/notes/notes.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProductsModule } from './modules/products/products.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { PulseFeedModule } from './modules/pulse-feed/pulse-feed.module';
import { UsersModule } from './modules/users/users.module';
import { AuthSharedModule } from './shared/guards/auth-shared.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    JwtModule.register({}),
    AuthSharedModule,
    AuthModule,
    UsersModule,
    DealsModule,
    ContactsModule,
    OrganizationsModule,
    ActivitiesModule,
    NotesModule,
    EmailsModule,
    LeadsModule,
    ProductsModule,
    CampaignsModule,
    ProjectsModule,
    InsightsModule,
    PulseFeedModule,
    AiModule,
    WebsocketModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
