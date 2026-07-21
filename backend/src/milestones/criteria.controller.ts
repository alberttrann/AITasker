import { Controller, Param, Put, Body, UseGuards, Get, Post, Delete } from '@nestjs/common';
import { CriteriaService } from './criteria.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { VerifyCriterionDto } from './dto/verify-criterion.dto';
import { RevisionNoteDto } from './dto/revision-note.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Acceptance Criteria')
@ApiBearerAuth('JWT')
@Controller('criteria')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CriteriaController {
  constructor(private readonly criteriaService: CriteriaService) {}

  @Put(':id/verify')
  @Roles('CLIENT')
  @ApiOperation({ summary: 'Verify and sign off an acceptance criterion' })
  @ApiResponse({ status: 200, description: 'Criterion verified successfully.' })
  async verifyCriterion(
    @Param('id') criterionId: string,
    @Body() dto: VerifyCriterionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.criteriaService.verify(criterionId, dto, user);
  }

  @Put(':id/revision') 
  @Roles('CLIENT')
  async rejectCriterion(
    @Param('id') criterionId: string,
    @Body() dto: RevisionNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.criteriaService.requestRevision(criterionId, dto, user);
  }

  @Get(':milestoneId')
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  @ApiOperation({ summary: 'List acceptance criteria for a milestone' })
  async listCriteria(
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.criteriaService.listCriteria(milestoneId, user);
  }

  @Post(':milestoneId')
  @Roles('CLIENT')
  @ApiOperation({ summary: 'Add an acceptance criterion to a milestone' })
  async createCriterion(
    @Param('milestoneId') milestoneId: string,
    @Body() dto: { criterion_text: string; is_required?: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    return this.criteriaService.create(milestoneId, dto, user);
  }

  @Delete(':id')
  @Roles('CLIENT')
  @ApiOperation({ summary: 'Delete an acceptance criterion (only in DEFINED state)' })
  async deleteCriterion(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.criteriaService.deleteCriterion(id, user);
  }
}
