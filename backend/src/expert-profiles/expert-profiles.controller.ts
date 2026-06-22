import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ExpertProfileService } from './expert-profiles.service';
import { UpdateExpertProfileDto } from './dto/update-expert-profile.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';

/**
 * §0.11.I — Expert Profile Controller
 *
 * Handles the expert's own profile CRUD:
 * - GET /expert-profiles/me — full own profile view (own row + nested user
 *   fields, all expert_domain_depths, all expert_seam_claims)
 * - PUT /expert-profiles/me — partial update (engagement_model,
 *   archetype_history_json, stack_tags_json)
 *
 * All routes require JWT (JwtAuthGuard) + activeRole = EXPERT (RolesGuard).
 */
@Controller('expert-profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('EXPERT')
export class ExpertProfilesController {
  constructor(private readonly expertService: ExpertProfileService) {}

  /**
   * §0.11.I — GET /expert-profiles/me
   *
   * Returns full own profile view per §0.11.I: own expert_profiles row
   * (with nested user fields), all expert_domain_depths, all
   * expert_seam_claims. Includes tier states, submission counts, lockout
   * timestamps.
   *
   * R: expert_profiles, expert_domain_depths, expert_seam_claims.
   */
  @Get('me')
  @ApiBearerAuth('JWT')
  async getMyProfile(@CurrentUser() user: { id: string }) {
    return this.expertService.getMyProfile(user.id);
  }

  /**
   * §0.11.I — PUT /expert-profiles/me
   *
   * Partial update of expert_profiles. Writable fields per §0.11.I:
   * - engagement_model
   * - archetype_history_json
   * - stack_tags_json
   *
   * bio is NOT here — handled by PUT /users/me (Chí Nhân's module).
   * 404 if profile row missing (registration creates it per §0.11.A).
   */
  @Put('me')
  @ApiBearerAuth('JWT')
  async updateMyProfile(@CurrentUser() user: { id: string }, @Body() dto: UpdateExpertProfileDto) {
    return this.expertService.updateMyProfile(user.id, dto);
  }
}
