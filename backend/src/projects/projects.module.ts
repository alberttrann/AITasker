import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { PrismaModule } from '../database/prisma.module';
import { ElicitationModule } from '../elicitation/elicitation.module';

// ProjectsModule owns:
//   - ProjectsService  (GET /projects/:id, GET /projects/:id/artifact-a,
//                       internal triggerMatching delegation)
//   - MatchingService  (FastAPI /llm/matching call + shortlist persistence)
@Module({
  imports: [PrismaModule, ElicitationModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
