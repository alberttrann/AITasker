import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { MatchingService } from './matching.service';
import { PrismaModule } from '../database/prisma.module';
import { ElicitationModule } from '../elicitation/elicitation.module'; // Imported to provide FastApiClient

// ProjectsModule owns:
//   - ProjectsService  (GET /projects/:id, GET /projects/:id/artifact-a,
//                       internal triggerMatching delegation)
@Module({
  imports: [PrismaModule, ElicitationModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, MatchingService],
  exports: [ProjectsService, MatchingService],
})
export class ProjectsModule {}
