import { Module } from '@nestjs/common';
import { BidsController } from './bids.controller';
import { BidsService } from './bids.service';
import { ShortlistService } from './shortlist.service';
import { PrismaModule } from '../database/prisma.module';
import { ElicitationModule } from '../elicitation/elicitation.module';

@Module({
  imports: [PrismaModule, ElicitationModule],
  controllers: [BidsController],
  providers: [BidsService, ShortlistService],
})
export class BidsModule {}
