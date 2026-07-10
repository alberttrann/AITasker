import { Controller, Get, Put, Body, UseGuards, Param, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ExpertProfileService } from './expert-profiles.service';
import { UpdateExpertProfileDto } from './dto/update-expert-profile.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags, ApiQuery, ApiOperation } from '@nestjs/swagger';

@ApiTags('Expert Profiles')
@Controller('expert-profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('EXPERT')
export class ExpertProfilesController {
  constructor(private readonly expertService: ExpertProfileService) {}

  @Get('me')
  @ApiBearerAuth('JWT')
  async getMyProfile(@CurrentUser() user: { id: string }) {
    return this.expertService.getMyProfile(user.id);
  }

  @Put('me')
  @ApiBearerAuth('JWT')
  async updateMyProfile(@CurrentUser() user: { id: string }, @Body() dto: UpdateExpertProfileDto) {
    return this.expertService.updateMyProfile(user.id, dto);
  }

  // Search / browse experts (for CEO on matching page)
  @Get('search')
  @ApiBearerAuth('JWT')
  @Roles('CLIENT', 'ADMIN')
  @ApiQuery({ name: 'domain', required: false })
  @ApiQuery({ name: 'seam', required: false })
  @ApiQuery({ name: 'archetype', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async searchExperts(
    @Query('domain') domain?: string,
    @Query('seam') seam?: string,
    @Query('archetype') archetype?: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.expertService.searchExperts({ domain, seam, archetype, limit });
  }

  // View another expert's profile (CEO researching a match)
  @Get(':userId')
  @ApiBearerAuth('JWT')
  @Roles('CLIENT', 'ADMIN')
  async getExpertProfile(@Param('userId') userId: string) {
    return this.expertService.getPublicExpertProfile(userId);
  }

  @Get('me/domains')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: "List my domain depth claims" })
  async getMyDomains(@CurrentUser() user: { id: string }) {
    return this.expertService.getMyDomains(user.id);
  }

  @Get('me/seams')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: "List my seam claims with verification status" })
  async getMySeams(@CurrentUser() user: { id: string }) {
    return this.expertService.getMySeams(user.id);
  }
}
