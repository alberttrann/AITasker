import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscriptions.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
    @Body() activateSubscriptionDto: ActivateSubscriptionDto,
  ) {
    return this.subscriptionService.activateSubscription(user.id, activateSubscriptionDto);
  }

  @ApiBearerAuth('JWT')
  @Get('status')
  getSubscriptionStatus(@CurrentUser() user: AuthUser) {
    return this.subscriptionService.getSubscriptionStatus(user.id);
  }
}
