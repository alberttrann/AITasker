import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { AppController } from './app.controller';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';
import { PaymentsModule } from './payments/payments.module';
import { ElicitationModule } from './elicitation/elicitation.module';
import { MilestonesModule } from './milestones/milestones.module';
import { SubscriptionModule } from './subscriptions/subscriptions.module';
import { ProjectsModule } from './projects/projects.module';
import { ExpertProfilesModule } from './expert-profiles/expert-profiles.module';
import { LedgerModule } from '@shared/ledger/ledger.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ListingsModule } from './listings/listings.module';
import { EngagementsModule } from './engagements/engagements.module';
import { BidsModule } from './bids/bids.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { MessagesModule } from './messages/messages.module';
import { ReviewsModule } from './reviews/reviews.module';
import { DisputesModule } from './disputes/disputes.module';
import { AdminModule } from './admin/admin.module';
import { InvitationsModule } from './invitations/invitations.module';
import { AppConfigModule } from './config/config.module';
import { InternalModule } from './internal/internal.module';
import { NotificationsModule } from './notifications/notifications.module'
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    // ─── M1 modules (Chí Nhân) ────────────────────────────────────────────
    AuthModule,
    UsersModule,
    WalletModule,
    PaymentsModule,
    SubscriptionModule,
    LedgerModule,
    // ─── M2 modules (Cao Minh) ────────────────────────────────────────────
    ElicitationModule,
    ProjectsModule,
    ExpertProfilesModule,
    ListingsModule,
    EngagementsModule,
    BidsModule,
    DisputesModule,
    // ─── M3 modules (Minh Thức) ───────────────────────────────────────────
    MilestonesModule,
    SubmissionsModule,
    MessagesModule,
    ReviewsModule,
    AdminModule,
    InvitationsModule,
    AppConfigModule,
    InternalModule,
    NotificationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
