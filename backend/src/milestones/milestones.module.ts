import { Module }               from '@nestjs/common';
import { MilestonesController } from './milestones.controller';
import { MilestonesService }    from './milestones.service';
import { DodController }        from './dod.controller';
import { DodService }           from './dod.service';
import { CriteriaController }   from './criteria.controller';
import { CriteriaService }      from './criteria.service';
import { PrismaModule }         from '../database/prisma.module';
import { FastapiClientModule }  from '../elicitation/fastapi-client.module';

@Module({
  imports:     [PrismaModule, FastapiClientModule],
  controllers: [MilestonesController, DodController, CriteriaController],
  providers:   [MilestonesService, DodService, CriteriaService],
  exports:     [MilestonesService],
})
export class MilestonesModule {}