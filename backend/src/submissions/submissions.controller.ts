import { Controller, Post, Get, Body, Param, UseGuards, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { StagePaygatedDocDto } from './dto/stage-paygated-doc.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BulkStagePaygatedDocsDto } from './dto/stage-paygated-doc.dto'; 
@ApiTags('Submissions')
@ApiBearerAuth('JWT')
@Controller('milestones') 
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post(':id/submit')
  @Roles('EXPERT')
  @ApiOperation({ summary: 'Expert submits deliverable for a milestone (DoD gate enforced)' })
  async submitMilestone(
    @Param('id') milestoneId: string,
    @Body() dto: CreateSubmissionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.submissionsService.submitMilestones(milestoneId, user.id, dto);
  }

  @Post(':id/paygated-docs')
  @Roles('EXPERT') 
  @ApiOperation({ summary: 'Expert stages a detailed technical paygated document' })
  async uploadDocument(@Param('id') milestoneId: string, @Body() dto: StagePaygatedDocDto) {
    return this.submissionsService.uploadDocument(milestoneId, dto);
  }

  @Post(':id/paygated-docs/bulk')
  @Roles('EXPERT')
  @ApiOperation({ summary: 'Expert stages multiple technical paygated documents atomically' })
  async uploadBulkDocuments(
    @Param('id') milestoneId: string,
    @Body() dto: BulkStagePaygatedDocsDto,
  ) {
    return this.submissionsService.uploadBulkDocuments(milestoneId, dto.documentUrls);
  }

  @Get(':id/paygated-docs')
  @Roles('TECH_TEAM', 'EXPERT') 
  @ApiOperation({ summary: 'TECH_TEAM or EXPERT downloads unlocked documents (CEO is excluded)' })
  async downloadDocument(
    @Param('id') milestoneId: string,
    @CurrentUser() user: { id: string; activeRole: string; clientSubtype?: string | null },
  ) {
    return this.submissionsService.downloadDocument(milestoneId, user);
  }

  @Delete(':id/submissions/latest')
  @Roles('EXPERT')
  @ApiOperation({ summary: 'Expert: retract latest submission and revert state to IN_PROGRESS' })
  async retractSubmission(
    @Param('id') milestoneId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.submissionsService.retractSubmission(milestoneId, user.id);
  }

  @Get(':id/submissions')
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  @ApiOperation({ summary: 'List all submissions (revision history) for a milestone' })
  async getSubmissions(
    @Param('id') milestoneId: string,
    @CurrentUser() user: { id: string; activeRole: string; clientSubtype?: string | null },
  ) {
    return this.submissionsService.listSubmissions(milestoneId, user);
  }

  @Get(':id/submissions/latest')
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  @ApiOperation({ summary: 'Get the most recent submission for a milestone' })
  async getLatestSubmission(
    @Param('id') milestoneId: string,
    @CurrentUser() user: { id: string; activeRole: string; clientSubtype?: string | null },
  ) {
    return this.submissionsService.getLatestSubmission(milestoneId, user);
  }
}
