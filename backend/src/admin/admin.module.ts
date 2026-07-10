import { Module } from '@nestjs/common';
import { DisputesModule } from '../disputes/disputes.module';
import { PrismaModule } from '../database/prisma.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminConfigController } from './config/admin-config.controller';
import { AdminConfigService } from './config/admin-config.service';

@Module({
  imports: [DisputesModule, PrismaModule],
  controllers: [AdminController, AdminConfigController], // <-- Added AdminConfigController
  providers: [AdminService, AdminConfigService], // <-- Added AdminConfigService
})
export class AdminModule {}
