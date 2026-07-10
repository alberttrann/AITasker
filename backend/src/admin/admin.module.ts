import { Module } from '@nestjs/common';
import { DisputesModule } from '../disputes/disputes.module';
import { PrismaModule } from '../database/prisma.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminConfigController } from './config/admin-config.controller';
import { AdminConfigService } from './config/admin-config.service';
import { AdminPromptsController } from './prompts/admin-prompts.controller';
import { AdminPromptsService }    from './prompts/admin-prompts.service';

@Module({
  imports: [DisputesModule, PrismaModule],
  controllers: [AdminController, AdminConfigController, AdminPromptsController],
  providers:   [AdminService, AdminConfigService, AdminPromptsService],
})
export class AdminModule {}