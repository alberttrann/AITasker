import { Controller, Put, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ExpertProfileService } from './expert-profiles.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UpsertDomainDepthDto } from './dto/upsert-domain-depth.dto';

/**
 * §0.11.I — Expert Domain Depth Controller
 *
 * Handles expert_domain_depths CRUD:
 * - POST /expert-domain-depths      — declare new depth claim at Tier 1
 * - PUT  /expert-domain-depths/:id  — update depth_level on existing claim
 *
 * All routes require JWT + activeRole = EXPERT.
 */
@Controller('expert-domain-depths')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('EXPERT')
export class DomainDepthsController {
  constructor(private readonly expertProfileService: ExpertProfileService) {}

  /**
   * §0.11.I — POST /expert-domain-depths
   *
   * Declares a new domain depth claim at Tier 1 (verification_tier =
   * CLAIMED, default per schema).
   *
   * - 422 on invalid domain_code (DTO @IsEnum + ValidationPipe).
   * - 409 on duplicate (expert_id, domain_code) per §0.11.I.
   */
  @Post()
  @ApiBearerAuth('JWT')
  async createDomainDepth(@CurrentUser() user: { id: string }, @Body() dto: UpsertDomainDepthDto) {
    return this.expertProfileService.createDomainDepth(user.id, dto);
  }

  /**
   * §0.11.I — PUT /expert-domain-depths/:id
   *
   * Updates depth_level only on an existing claim. domainCode is in the body
   * for DTO symmetry with POST but the service ignores it — it's part of the
   * (expert_id, domain_code) natural key per the schema's @@unique constraint
   * and is immutable here.
   *
   * - 403 if caller is not the owner (not the expert who created the row).
   * - 404 if the row doesn't exist.
   */
  @Put(':id')
  @ApiBearerAuth('JWT')
  async updateDomainDepth(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpsertDomainDepthDto,
  ) {
    return this.expertProfileService.updateDomainDepth(user.id, id, dto.depthLevel);
  }
}
