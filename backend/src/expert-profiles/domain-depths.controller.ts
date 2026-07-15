import { Controller, Put, Post, Param, Body, UseGuards, ParseUUIDPipe, Delete } from '@nestjs/common';
import { ExpertProfileService } from './expert-profiles.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { UpsertDomainDepthDto } from './dto/upsert-domain-depth.dto';
import { SyncDomainsDto } from './dto/sync-domains.dto';
@ApiTags('Expert Domains')
@Controller('expert-profile/domains')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('EXPERT')
export class DomainDepthsController {
  constructor(private readonly expertProfileService: ExpertProfileService) {}

  @Post()
  @ApiBearerAuth('JWT')
  async createDomainDepth(@CurrentUser() user: { id: string }, @Body() dto: UpsertDomainDepthDto) {
    return this.expertProfileService.createDomainDepth(user.id, dto);
  }

  @Put('sync')
  @ApiBearerAuth('JWT')
  async syncDomainDepths(@CurrentUser() user: { id: string }, @Body() dto: SyncDomainsDto) {
    return this.expertProfileService.syncDomainDepths(user.id, dto.domains);
  }

  @Put(':id')
  @ApiBearerAuth('JWT')
  async updateDomainDepth(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpsertDomainDepthDto,
  ) {
    return this.expertProfileService.updateDomainDepth(user.id, id, dto.depthLevel);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Delete a domain depth entry (only if no portfolio submissions)' })
  async deleteDomainDepth(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.expertProfileService.deleteDomainDepth(user.id, id);
  }
}
