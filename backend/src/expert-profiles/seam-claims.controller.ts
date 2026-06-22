import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ExpertProfileService } from './expert-profiles.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UpsertSeamClaimDto } from './dto/upsert-seam-claim.dto';

/**
 * §0.11.I — Expert Seam Claim Controller
 *
 * Handles expert_seam_claims CRUD:
 * - POST /expert-seam-claims — declare a new seam claim at Tier 1 (CLAIMED)
 *
 * All routes require JWT + activeRole = EXPERT.
 */
@Controller('expert-seam-claims')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('EXPERT')
export class SeamClaimsController {
  constructor(private readonly expertProfileService: ExpertProfileService) {}

  /**
   * §0.11.I — POST /expert-seam-claims
   *
   * Declares a new seam claim at CLAIMED (Tier 1, weight 0.20 per §0.4).
   * Schema defaults: submission_count = 0, locked_until = NULL.
   *
   * - 422 on seam_code not in SEAM_CODE (handled by DTO @IsEnum + ValidationPipe).
   * - 409 on duplicate (expert_id, seam_code) per §0.11.I.
   * - Claim row is otherwise immutable; "update" semantics go through
   *   /portfolio-submissions (Tier 2 verification upgrades verification_tier
   *   + increments submission_count per BR-VER-06).
   *
   * No subscription gate ([None]) — declaring is free per BR-SUB-04;
   * verifying (via /portfolio-submissions) is the [Pro-E]-gated step.
   */
  @Post()
  @ApiBearerAuth('JWT')
  async createSeamClaim(@CurrentUser() user: { id: string }, @Body() dto: UpsertSeamClaimDto) {
    return this.expertProfileService.createSeamClaim(user.id, dto);
  }
}
