import { Controller, Get, Put, Body, Param, Query, UseGuards, Post, Delete, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

type ActorUser = { id: string };

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) { }

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
  async getTransactions(
    @Query('type') type?: string,
    @Query('userId') userId?: string,
  ) {
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
  @ApiOperation({ summary: 'Manually confirm a withdrawal was sent (no real Chi Hộ callback exists)' })
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
  @ApiOperation({ summary: 'Update subscription package price/duration (existing subs unaffected)' })
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

  @Get('users')
  @ApiOperation({ summary: 'List all users with optional filters' })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, description: 'email or fullName partial match' })
  async listUsers(
    @Query('role') role?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.listUsers({ 
      role, 
      isActive: isActive !== undefined ? isActive === 'true' : undefined, 
      search 
    });
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get full user detail including wallet and subscriptions' })
  async getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }


  @Get('projects')
  @ApiOperation({ summary: 'List all projects (admin oversight)' })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'archetype', required: false })
  async listProjects(
    @Query('state') state?: string,
    @Query('archetype') archetype?: string,
  ) {
    return this.adminService.listProjects({ state, archetype });
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'Get full project detail (admin view)' })
  async getProjectDetail(@Param('id') id: string) {
    return this.adminService.getProjectDetail(id);
  }

  @Get('engagements')
  @ApiOperation({ summary: 'List all engagements (admin oversight)' })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'projectId', required: false })
  async listEngagements(
    @Query('state') state?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.adminService.listEngagements({ state, projectId });
  }

  @Get('experts')
  @ApiOperation({ summary: 'List all expert users with verification status' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listExperts(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.adminService.listExperts({ limit });
  }

  @Put('projects/:id/reopen')
  @ApiOperation({ summary: 'Reopen a suspended project' })
  async reopenProject(@Param('id') id: string) {
    return this.adminService.reopenProject(id);
  }
}