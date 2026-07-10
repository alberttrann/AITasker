import { Controller, Get, Put, Body, Param, Query, UseGuards, Post, Delete } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

type ActorUser = { id: string };

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Put('projects/:id/suspend-spec')
  @ApiOperation({ summary: 'Emergency pull-back of a published project spec' })
  async suspendSpec(@Param('id') id: string) {
    return this.adminService.suspendSpec(id);
  }

  @Put('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend a fraudulent or abusive account' })
  async suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  @Get('disputes')
  @ApiOperation({ summary: 'Disputes queue, optionally filtered by state' })
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

  @Get('decisions')
  @ApiOperation({ summary: 'Platform decisions log (LLM confidence, advisory notes, entity refs)' })
  async getDecisions(
    @Query('decisionType') decisionType?: string,
    @Query('entityType') entityType?: string,
  ) {
    return this.adminService.getDecisions({ decisionType, entityType });
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Wallet transaction ledger, filterable by type/user' })
  async getTransactions(@Query('type') type?: string, @Query('userId') userId?: string) {
    return this.adminService.getTransactions({ type, userId });
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Platform-wide computed aggregates' })
  async getAnalytics() {
    return this.adminService.getAnalytics();
  }

  @Get('withdrawals')
  @ApiOperation({ summary: 'Withdrawal requests queue, optionally filtered by status' })
  async getWithdrawalsQueue(@Query('status') status?: string) {
    return this.adminService.getWithdrawalsQueue(status);
  }

  @Put('withdrawals/:id/complete')
  @ApiOperation({
    summary: 'Manually confirm a withdrawal was sent (no real Chi Hộ callback exists)',
  })
  async completeWithdrawal(@Param('id') id: string) {
    return this.adminService.completeWithdrawal(id);
  }

  @Put('withdrawals/:id/fail')
  @ApiOperation({ summary: 'Mark a withdrawal as failed — refunds the wallet' })
  async failWithdrawal(@Param('id') id: string) {
    return this.adminService.failWithdrawal(id);
  }

  // Subscription Package Management
  @Get('subscriptions/packages')
  @ApiOperation({ summary: 'List all subscription packages' })
  listSubscriptionPackages() {
    return this.adminService.listSubscriptionPackages();
  }

  @Post('subscriptions/packages')
  @ApiOperation({ summary: 'Create a new subscription package' })
  createSubscriptionPackage(
    @Body() dto: { role: string; name: string; priceVnd: number; durationMonths: number },
  ) {
    return this.adminService.createSubscriptionPackage(dto);
  }

  @Put('subscriptions/packages/:id')
  @ApiOperation({
    summary: 'Update subscription package price/duration (existing subs unaffected)',
  })
  updateSubscriptionPackage(
    @Param('id') id: string,
    @Body() dto: { priceVnd?: number; durationMonths?: number; name?: string; isActive?: boolean },
  ) {
    return this.adminService.updateSubscriptionPackage(id, dto);
  }

  @Delete('subscriptions/packages/:id')
  @ApiOperation({
    summary: 'Hard-delete a subscription package',
    description:
      'Only succeeds if the package has zero purchase history. ' +
      'If it has been purchased before, use PUT with isActive: false to deactivate it instead.',
  })
  @ApiResponse({ status: 200, description: 'Package deleted.' })
  @ApiResponse({ status: 422, description: 'Package has purchase history — deactivate instead.' })
  @ApiResponse({ status: 404, description: 'Package not found.' })
  deleteSubscriptionPackage(@Param('id') id: string) {
    return this.adminService.deleteSubscriptionPackage(id);
  }
}
