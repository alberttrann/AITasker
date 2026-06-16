import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { MilestonesService }  from './milestones.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';

// FIX [BLOCK-1]: guards/decorators live in common/, not auth/
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../common/guards/roles.guard';
import { Roles }        from '../common/decorators/roles.decorator';

@Controller('milestones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post()
  // FIX [BLOCK-2]: 'TECH_TEAM' / 'CEO' are clientSubtype values, not activeRole.
  // Both CEO and TECH_TEAM users carry activeRole = 'CLIENT' in their JWT.
  // RolesGuard checks user.activeRole — so the correct value is 'CLIENT'.
  @Roles('CLIENT')
  async createMilestone(@Body() dto: CreateMilestoneDto) {
    return this.milestonesService.createMilestone(dto);
  }
}