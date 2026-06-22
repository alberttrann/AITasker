import { Controller, Post, Body, UseGuards, Put, Param } from '@nestjs/common';
import { MilestonesService }  from './milestones.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';

// FIX [BLOCK-1]: guards/decorators live in common/, not auth/
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../common/guards/roles.guard';
import { Roles }        from '../common/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

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

  @Put(':id/fund')    
  @Roles('CLIENT')
  @ApiOperation({ summary: 'Initiate funding for a milestone' })
  @ApiResponse({ status: 200, description: 'Milestone status updated to AWAITING_PAYMENT.' })
  async fundMilestone(@Param('id') id: string) {
    return this.milestonesService.initiateFunding(id);  
  }
}