import { Controller, Get, Post, Put, Param, Query, UseGuards, Request, Body, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MilestoneChatDto } from './dto/milestone-chat.dto';
import { UpdateProjectMilestonesDto } from './dto/update-project-milestones.dto';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('marketplace')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('EXPERT', 'ADMIN')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Expert: browse open, published projects on the marketplace' })
  @ApiQuery({ name: 'archetype', required: false })
  @ApiQuery({ name: 'tier', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMarketplace(
    @Query('archetype') archetype?: string,
    @Query('tier') tier?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.projectsService.getMarketplaceProjects({ archetype, tier, limit });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  @ApiBearerAuth('JWT')
  async getProjectDetails(@Param('id') projectId: string, @Request() req: any) {
    return this.projectsService.findProject(
      projectId,
      req.user.id,
      req.user.activeRole,
      req.user.clientSubtype,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @ApiBearerAuth('JWT')
  @ApiQuery({ name: 'slim', required: false, type: Boolean })
  async getProjects(@Request() req: any, @Query('slim') slim?: string) {
    const { id, activeRole, clientSubtype } = req.user;
    return this.projectsService.getProjects(id, activeRole, clientSubtype, slim === 'true');
  }

  @Get(':id/artifact-a')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT', 'EXPERT')
  @ApiBearerAuth('JWT')
  async getProjectArtifactA(@Param('id') projectId: string, @Request() req: any) {
    return this.projectsService.findProjectArtifactA(
      projectId,
      req.user.id,
      req.user.activeRole,
      req.user.clientSubtype,
    );
  }

  @Get(':id/artifact-b')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  @ApiBearerAuth('JWT')
  async getProjectArtifactB(@Param('id') projectId: string, @Request() req: any) {
    return this.projectsService.findProjectArtifactB(
      projectId,
      req.user.id,
      req.user.activeRole,
      req.user.clientSubtype,
    );
  }

  @Put(':id/name')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @ApiBearerAuth('JWT')
  async updateProjectName(
    @Param('id') projectId: string,
    @Body('projectName') projectName: string,
    @Request() req: any,
  ) {
    return this.projectsService.updateProjectName(projectId, req.user.id, projectName);
  }

  @Put(':id/milestones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update the project milestone framework' })
  async updateProjectMilestones(
    @Param('id') projectId: string,
    @Body() dto: UpdateProjectMilestonesDto,
    @Request() req: any,
  ) {
    return this.projectsService.updateProjectMilestones(
      projectId,
      req.user.id,
      dto.milestones ?? dto.milestoneFramework ?? [],
    );
  }

  // Milestone contextual chatbot

  @Post(':id/milestone-chat')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT', 'EXPERT')
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Send a message to the milestone assistant',
    description:
      'Omit chatSessionId to start a new conversation. ' +
      'Pass chatSessionId from a previous response to continue an existing one. ' +
      'History is persisted in the DB — no need to send it from the client.',
  })
  async milestoneChatMessage(
    @Param('id') projectId: string,
    @Body() dto: MilestoneChatDto,
    @Request() req: any,
  ) {
    return this.projectsService.milestoneChatHandler(
      projectId,
      req.user.id,
      dto.message,
      dto.chatSessionId,
      dto.currentMilestones,
    );
  }

  @Get(':id/milestone-chat/sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT', 'EXPERT')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List past chat sessions for this project (for sidebar)' })
  async listChatSessions(@Param('id') projectId: string, @Request() req: any) {
    return this.projectsService.listMilestoneChatSessions(projectId, req.user.id);
  }

  @Get(':id/milestone-chat/sessions/:sessionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CLIENT', 'EXPERT')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get full message history for a specific chat session' })
  async getChatSession(
    @Param('id') projectId: string,
    @Param('sessionId') sessionId: string,
    @Request() req: any,
  ) {
    return this.projectsService.getMilestoneChatSession(projectId, sessionId, req.user.id);
  }

}
