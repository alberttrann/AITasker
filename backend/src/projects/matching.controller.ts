import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Matching')
@Controller('matching')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MatchingController {
  constructor(private readonly projectsService: ProjectsService) {}

  // CEO-owner only, [Pro-C] (implied — only a Pro-C session can
  // reach PUBLISHED in the first place), 422 if project.state !== PUBLISHED.
  @Get(':projectId/shortlist')
  @Roles('CLIENT')
  @ApiBearerAuth('JWT')
  async getShortlist(@Param('projectId') projectId: string, @Request() req: any) {
    return this.projectsService.getMatchingShortlist(projectId, req.user.id);
  }
}