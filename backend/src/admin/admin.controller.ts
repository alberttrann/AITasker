// backend/src/admin/admin.controller.ts
import { Controller, Get, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

type ActorUser = { id: string };

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('disputes')
  @ApiOperation({ summary: 'Disputes queue, optionally filtered by state (e.g. ESCALATED)' })
  async getDisputesQueue(@CurrentUser() user: ActorUser, @Query('state') state?: string) {
    return this.adminService.getDisputesQueue(user.id, state);
  }

  @Put('disputes/:id/resolve')
  @ApiOperation({ summary: 'Manually resolve an escalated dispute' })
  async resolveDispute(
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
    @CurrentUser() user: ActorUser,
  ) {
    return this.adminService.resolveDispute(id, dto, user.id);
  }
}