import { Controller, Post, Get, Body, UseGuards, Put, Param } from '@nestjs/common';
import { MilestonesService }  from './milestones.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../common/guards/roles.guard';
import { Roles }        from '../common/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Milestones')
@ApiBearerAuth('JWT')
@Controller('milestones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post()
  @Roles('CLIENT')
  @ApiOperation({ summary: 'Create a new milestone' }) 
  @ApiResponse({ status: 201, description: 'Milestone created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  async createMilestone(@Body() dto: CreateMilestoneDto) {
    return this.milestonesService.createMilestone(dto);
  }

  @Get(':id')
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  @ApiOperation({ summary: 'Get a milestone by id, including criteria' })
  @ApiResponse({ status: 200, description: 'Milestone detail.' })
  @ApiResponse({ status: 404, description: 'Milestone not found.' })
  async getMilestone(@Param('id') id: string) {
    return this.milestonesService.getMilestone(id);
  }

  @Put(':id/fund')    
  @Roles('CLIENT')
  @ApiOperation({ summary: 'Initiate funding for a milestone' })
  @ApiResponse({ status: 200, description: 'Milestone status updated to AWAITING_PAYMENT.' })
  async fundMilestone(@Param('id') id: string) {
    return this.milestonesService.initiateFunding(id);  
  }
}