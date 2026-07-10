import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { MatchingController } from './matching.controller';
import { ProjectsService } from './projects.service';
import { MatchingService } from './matching.service';
import { PrismaModule } from '../database/prisma.module';
import { FastapiClientModule } from '../elicitation/fastapi-client.module';
import { MatchingHelperModule } from '../shared/matching/matching-helper.module';

@Module({
  imports: [PrismaModule, FastapiClientModule, MatchingHelperModule],
  controllers: [ProjectsController, MatchingController],
  providers: [ProjectsService, MatchingService],
  exports: [ProjectsService, MatchingService],
})
export class ProjectsModule {}
