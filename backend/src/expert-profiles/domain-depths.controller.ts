import { Controller, Put, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ExpertProfileService } from './expert-profiles.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UpsertDomainDepthDto } from './dto/upsert-domain-depth.dto';

@Controller('expert-domain-depths')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('EXPERT')
export class DomainDepthsController {
  constructor(private readonly expertProfileService: ExpertProfileService) {}

  // POST /expert-domain-depths
  // Declares a new domain depth claim at Tier 1 (CLAIMED).
  // 409 on duplicate (expert_id, domain_code) per §0.11.I.
  @Post()
  @ApiBearerAuth('JWT')
  async createDomainDepth(@CurrentUser() user: { id: string }, @Body() dto: UpsertDomainDepthDto) {
    return this.expertProfileService.createDomainDepth(user.id, dto);
  }

  // PUT /expert-domain-depths/:id
  // Updates depth_level only. domainCode is in the body for DTO symmetry with POST
  // but the service ignores it — it's part of the (expert_id, domain_code)
  // natural key per the schema's @@unique constraint and is immutable.
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
