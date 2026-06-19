import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscriptions.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthUser } from 'src/auth/strategies/jwt.strategy';
import { ActivateSubscriptionDto } from './dto/activate-subscription.dto';

@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @Post('activate')
  activateSubscription(
    @CurrentUser() user: AuthUser,
    @Body() activateSubscriptionDto: ActivateSubscriptionDto,
  ) {
    return this.subscriptionService.activateSubscription(user.id, activateSubscriptionDto);
  }
}
