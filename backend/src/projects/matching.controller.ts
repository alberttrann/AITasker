import { Controller, Get, Param, Query, UseGuards, Request, ParseUUIDPipe } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { MatchingService } from './matching.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Matching')
@Controller('matching')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MatchingController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly matchingService: MatchingService,
  ) {}

  /**
   * GET /matching/:projectId/shortlist
   * CEO-owner only. Pass ?refresh=true to force re-score against all currently
   * registered experts (evicts the in-memory cache and re-runs /llm/matching).
   * Without refresh=true, returns the cached result seeded at project publication.
   */
  @Get(':projectId/shortlist')
  @Roles('CLIENT')
  @ApiBearerAuth('JWT')
  @ApiQuery({
    name: 'refresh',
    required: false,
    type: Boolean,
    description: 'Set true to force re-score matching against all current experts.',
  })
  async getShortlist(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('refresh') refresh: string,
    @Request() req: any,
  ) {
    if (refresh === 'true') {
      await this.matchingService.forceRefresh(projectId);
    }
    return this.projectsService.getMatchingShortlist(projectId, req.user.id);
  }
}
