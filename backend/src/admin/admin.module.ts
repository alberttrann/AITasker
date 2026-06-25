// backend/src/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { DisputesModule } from '../disputes/disputes.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [DisputesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}