import { Controller, Param, Put, Body, UseGuards } from '@nestjs/common';
import { CriteriaService } from './criteria.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { VerifyCriterionDto } from './dto/verify-criterion.dto';
import { RevisionNoteDto } from './dto/revision-note.dto';

@Controller('criteria')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CriteriaController {
  constructor(private readonly criteriaService: CriteriaService) {}

  @Put(':id/verify')
  @Roles('CLIENT')
  async verifyCriterion(
    @Param('id') criterionId: string,
    @Body() dto: VerifyCriterionDto, 
  ) {
    return this.criteriaService.verify(criterionId, dto);
  }

  @Put(':id/revision') 
  @Roles('CLIENT')
  async rejectCriterion(
    @Param('id') criterionId: string,
    @Body() dto: RevisionNoteDto, 
  ) {
    return this.criteriaService.requestRevision(criterionId, dto);
  }
}