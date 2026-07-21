import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ExpertProfileService } from './expert-profiles.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UpsertSeamClaimDto } from './dto/upsert-seam-claim.dto';
import { Put } from '@nestjs/common';
import { SyncSeamsDto } from './dto/sync-seams.dto';
@ApiTags('Seam Claims')
@Controller('expert-profile/seams')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('EXPERT')
export class SeamClaimsController {
  constructor(private readonly expertProfileService: ExpertProfileService) {}

  @Post()
  @ApiBearerAuth('JWT')
  async createSeamClaim(@CurrentUser() user: { id: string }, @Body() dto: UpsertSeamClaimDto) {
    return this.expertProfileService.createSeamClaim(user.id, dto);
  }

  @Put('sync')
  @Post('sync')
  @ApiBearerAuth('JWT')
  async syncSeamClaims(@CurrentUser() user: { id: string }, @Body() dto: SyncSeamsDto) {
    return this.expertProfileService.syncSeamClaims(user.id, dto.seams);
  }
}
