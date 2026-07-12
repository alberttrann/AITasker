import { Controller, Post, Get, Body, UseGuards, Put, Patch, Delete, Param, Query } from '@nestjs/common';
import { MilestonesService }  from './milestones.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../common/guards/roles.guard';
import { Roles }        from '../common/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { BulkInitializeMilestonesDto } from './dto/bulk-initialize-milestones.dto';
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

  // Edit milestone fields (only while state = DEFINED)
  @Patch(':id')
  @Roles('CLIENT')
  @ApiOperation({ summary: 'Edit milestone details — only while state is DEFINED' })
  @ApiResponse({ status: 200, description: 'Milestone updated.' })
  @ApiResponse({ status: 422, description: 'Milestone is not in DEFINED state.' })
  async updateMilestone(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.milestonesService.updateMilestone(id, user.id, dto);
  }

  // Delete milestone (only while state = DEFINED)
  @Delete(':id')
  @Roles('CLIENT')
  @ApiOperation({ summary: 'Delete a milestone — only while state is DEFINED' })
  @ApiResponse({ status: 200, description: 'Milestone deleted.' })
  @ApiResponse({ status: 422, description: 'Milestone is not in DEFINED state.' })
  async deleteMilestone(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.milestonesService.deleteMilestone(id, user.id);
  }
  // List milestones for an engagement
  @Get()
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List milestones, filtered by engagementId' })
  @ApiQuery({ name: 'engagementId', required: true })
  async listMilestones(@Query('engagementId') engagementId: string) {
    return this.milestonesService.listByEngagement(engagementId);
  }

  @Get(':id/disputes')
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List disputes for a milestone' })
  async getMilestoneDisputes(@Param('id') milestoneId: string) {
    return this.milestonesService.getMilestoneDisputes(milestoneId);
  }

  @Post('bulk')
  @Roles('CLIENT')
  @ApiOperation({ summary: 'Bulk initialize all contract milestones from the CEO final template' })
  async bulkInitialize(
    @CurrentUser() user: AuthUser,
    @Body() dto: BulkInitializeMilestonesDto,
  ) {
    return this.milestonesService.bulkInitialize(user.id, dto);
  }
}
