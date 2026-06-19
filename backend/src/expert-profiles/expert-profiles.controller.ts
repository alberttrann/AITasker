import { Controller, Get, UseGuards } from '@nestjs/common';
import { ExpertProfileService } from './expert-profiles.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('expert-profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('EXPERT')
export class ExpertProfilesController {
  constructor(private readonly expertService: ExpertProfileService) {}

  @Get('me')
  @ApiBearerAuth('JWT')
  async getMyProfile(@CurrentUser() user: { id: string }) {
    return this.expertService.getMyProfile(user.id);
  }
}
