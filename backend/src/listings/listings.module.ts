import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { PrismaModule } from '../database/prisma.module';
import { ElicitationModule } from '../elicitation/elicitation.module';

@Module({
  imports: [PrismaModule, ElicitationModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
