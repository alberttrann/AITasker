// backend/src/disputes/disputes.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { FastapiClientModule } from '../elicitation/fastapi-client.module';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

@Module({
  imports: [PrismaModule, FastapiClientModule],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}