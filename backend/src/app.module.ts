import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './database/prisma.module';
import { AppController } from './app.controller';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    PrismaModule,
    // ─── M1 modules (Chí Nhân) ────────────────────────────────────────────
    // AuthModule,
    // UsersModule,
    // WalletModule,
    // PaymentsModule,
    // ─── M2 modules (Cao Minh) ────────────────────────────────────────────
    // ElicitationModule,
    // ProjectsModule,
    // ExpertProfilesModule,
    // ListingsModule,
    // EngagementsModule,
    // BidsModule,
    // DisputesModule,
    // ─── M3 modules (Minh Thức) ───────────────────────────────────────────
    // MilestonesModule,
    // SubmissionsModule,
    // MessagesModule,
    // ReviewsModule,
    // AdminModule,
  ],
  controllers: [AppController],
})
export class AppModule {}