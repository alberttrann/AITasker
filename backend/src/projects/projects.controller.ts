import { Controller, Get, Param, Query, UseGuards, Request, Put, Body } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  @ApiBearerAuth('JWT')
  async getProjectDetails(@Param('id') projectId: string, @Request() req: any) {
    const userId = req.user.id;
    const activeRole = req.user.activeRole;
    const clientSubtype = req.user.clientSubtype;
    return this.projectsService.findProject(projectId, userId, activeRole, clientSubtype);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @ApiBearerAuth('JWT')
  @ApiQuery({
    name: 'slim',
    required: false,
    type: Boolean,
    description:
      'Return minimal fields only (id, projectName, state, archetype, tier, createdAt). ' +
      'Strips all JSON blobs — use for list cards to cut payload ~80%.',
  })
  async getProjects(@Request() req: any, @Query('slim') slim?: string) {
    const { id, activeRole, clientSubtype } = req.user;
    return this.projectsService.getProjects(id, activeRole, clientSubtype, slim === 'true');
  }

  @Get(':id/artifact-a')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT', 'EXPERT')
  @ApiBearerAuth('JWT')
  async getProjectArtifactA(@Param('id') projectId: string, @Request() req: any) {
    const userId = req.user.id;
    const activeRole = req.user.activeRole;
    const clientSubtype = req.user.clientSubtype;
    return this.projectsService.findProjectArtifactA(projectId, userId, activeRole, clientSubtype);
  }

  // CLIENT role passes the guard (so TECH_TEAM, whose
  // activeRole IS 'CLIENT', can reach the service layer) but the service
  // itself hard-denies CEO specifically
  @Get(':id/artifact-b')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  @ApiBearerAuth('JWT')
  async getProjectArtifactB(@Param('id') projectId: string, @Request() req: any) {
    const userId = req.user.id;
    const activeRole = req.user.activeRole;
    const clientSubtype = req.user.clientSubtype;
    return this.projectsService.findProjectArtifactB(projectId, userId, activeRole, clientSubtype);
  }

  @Put(':id/name')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @ApiBearerAuth('JWT')
  async updateProjectName(
    @Param('id') projectId: string, 
    @Body('projectName') projectName: string,
    @Request() req: any
  ) {
    return this.projectsService.updateProjectName(projectId, req.user.id, projectName);
  }
}