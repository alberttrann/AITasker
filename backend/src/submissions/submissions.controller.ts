import { Controller, Post, Get, Body, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from "@nestjs/swagger";
import { SubmissionsService } from "./submissions.service";
import { CreateSubmissionDto } from "./dto/create-submission.dto";
import { StagePaygatedDocDto } from "./dto/stage-paygated-doc.dto";

@ApiTags('submissions')
@ApiBearerAuth()
@Controller('submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post('milestones/:id/submit')
  @Roles('EXPERT')
  @ApiOperation({ summary: 'Expert submits deliverable for a milestone (DoD gate enforced)' })
  async submitMilestone( @Param('id') milestoneId: string, @Body() dto: CreateSubmissionDto,) {
    return this.submissionsService.submitMilestones(milestoneId, dto);
  }

  @Post('milestones/:id/paygated-docs')
  @Roles('EXPERT')
  @ApiOperation({ summary: 'Expert stages a detailed technical paygated document' })
  async uploadDocument( @Param('id') milestoneId: string, @Body() dto: StagePaygatedDocDto,) {
    return this.submissionsService.uploadDocument(milestoneId, dto);
  }

  @Get('milestones/:id/paygated-docs')
  @Roles('TECH_TEAM', 'EXPERT')
  @ApiOperation({ summary: 'TECH_TEAM or EXPERT downloads unlocked documents (CEO is excluded)' })
  async downloadDocument(@Param('id') milestoneId: string,) {
    return this.submissionsService.downloadDocument(milestoneId);
  }
}