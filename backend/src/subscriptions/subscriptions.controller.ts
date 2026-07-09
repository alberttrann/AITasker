import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscriptions.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthUser } from 'src/auth/strategies/jwt.strategy';
import { ActivateSubscriptionDto } from './dto/activate-subscription.dto';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@ApiTags('Subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENT', 'EXPERT')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @ApiBearerAuth('JWT')
  @Post('activate')
  activateSubscription(
    @CurrentUser() user: AuthUser,
    @Body() dto: ActivateSubscriptionDto,
  ) {
    return this.subscriptionService.activateSubscription(user.id, dto);
  }

  @ApiBearerAuth('JWT')
  @Get('status')
  getSubscriptionStatus(@CurrentUser() user: AuthUser) {
    return this.subscriptionService.getSubscriptionStatus(user.id);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get current user\'s subscription purchase history' })
  async getSubscriptionHistory(@CurrentUser() user: AuthUser) {
    return this.subscriptionService.getSubscriptionHistory(user.id);
  }
}
