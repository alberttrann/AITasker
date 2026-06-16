import { Module }               from '@nestjs/common';
import { MilestonesController } from './milestones.controller';
import { MilestonesService }    from './milestones.service';
import { PrismaModule }         from '../database/prisma.module'; // FIX [BLOCK-3]

@Module({
  imports:     [PrismaModule],        // PrismaModule already exports PrismaService
  controllers: [MilestonesController],
  providers:   [MilestonesService],   // FIX [BLOCK-5]: removed redundant PrismaService
  exports:     [MilestonesService],
})                                    // FIX [BLOCK-4]: was `}}` — now correctly `})`
export class MilestonesModule {}