import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';

// Projects controller
// Guard order mirrors the elicitation module convention:
//   1. JwtAuthGuard — validates token, populates req.user
// Role enforcement is done inside the service (membership check) rather than
// via RolesGuard because /projects/:id is accessible to CLIENT, TECH_TEAM,
// and EXPERT roles simultaneously.
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // GET /projects/:id
  // Returns project detail (excluding artifactBJson) for any project member.
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  @ApiBearerAuth('JWT')
  async getProjectDetails(@Param('id') projectId: string, @Request() req: any) {
    // extract
    const userId = req.user.id;
    const activeRole = req.user.activeRole; // 'CLIENT', 'EXPERT', 'ADMIN'
    const clientSubtype = req.user.clientSubtype;

    return this.projectsService.findProject(projectId, userId, activeRole, clientSubtype);
  }

  // GET /projects/:id/artifact-a
  // Public within platform for shortlisted experts, owner, and linked tech team.
  @Get(':id/artifact-a')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT', 'EXPERT')
  @ApiBearerAuth('JWT')
  async getProjectArtifactA(@Param('id') projectId: string, @Request() req: any) {
    // extract
    const userId = req.user.id;
    const activeRole = req.user.activeRole; // 'CLIENT', 'EXPERT', 'ADMIN'
    const clientSubtype = req.user.clientSubtype;

    return this.projectsService.findProjectArtifactA(projectId, userId, activeRole, clientSubtype);
  }
}
