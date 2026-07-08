import { ActiveRole } from '@common/enums/active-role.enum';
import { SubscriptionTier } from '@common/enums/subscription-tier';
import { SubscriptionPrice } from '@common/enums/subscription-price.enum';
import { TransactionType } from '@common/enums/transaction-type.enum';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ActivateSubscriptionDto } from 'src/subscriptions/dto/activate-subscription.dto';
import { addMonths } from 'date-fns';
import { AuthService } from 'src/auth/auth.service';
import { UnprocessableEntityException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async activateSubscription(userId: string, activateSubscriptionDto: ActivateSubscriptionDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found!');
    }

    const userCurrentActiveRole = activateSubscriptionDto.activeRole;

    if (user.activeRole !== userCurrentActiveRole) {
      throw new ConflictException(
        'You must switch to the target role before activating subscription!',
      );
    }

    const tierKey =
      userCurrentActiveRole === ActiveRole.CLIENT
        ? 'subscriptionClientTier'
        : 'subscriptionExpertTier';

    const expiresKey =
      userCurrentActiveRole === ActiveRole.CLIENT ? 'subClientExpiresAt' : 'subExpertExpiresAt';

    const price =
      userCurrentActiveRole === ActiveRole.CLIENT
        ? SubscriptionPrice.CLIENT_PRO_PRICE
        : SubscriptionPrice.EXPERT_PRO_PRICE;

    const roleTypeLabel = userCurrentActiveRole === ActiveRole.CLIENT ? 'client' : 'expert';

    const currentTime = new Date();
    const isCurrentlyActive =
      user[tierKey] === SubscriptionTier.PRO &&
      user[expiresKey] !== null &&
      user[expiresKey] > currentTime;

    if (isCurrentlyActive) {
      throw new ConflictException('Your subscription is still available');
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const userWallet = await tx.wallet.findUnique({
        where: { userId: user.id },
      });
      
      if (userWallet.availableBalance < price) {
        throw new UnprocessableEntityException('INSUFFICIENT_BALANCE');
      }

      await tx.wallet.update({
        where: { userId: user.id },
        data: {
          availableBalance: { decrement: BigInt(price) },
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: userWallet.id,
          amount: BigInt(price),
          transactionType: TransactionType.SUBSCRIPTION,
          referenceId: `SUB-${userId}:${roleTypeLabel}:${Date.now()}`,
        },
      });

      return tx.user.update({
        where: { id: user.id },
        data: {
          [tierKey]: SubscriptionTier.PRO,
          [expiresKey]: addMonths(new Date(), 6),
        },
      });
    });
    this.eventEmitter.emit('socket.broadcast', {
      userId: user.id,
      event: 'notification:generic',
      payload: {
        type: 'system',
        title: 'Pro Activated',
        body: `Welcome to ${roleTypeLabel === 'client' ? 'Client Pro' : 'Expert Pro'}!`,
      }
    });
    const access_token = await this.authService.jwtGeneratePayload(updatedUser);

    return { access_token };
  }

  async getSubscriptionStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found!');
    }

    const tierKey =
      user.activeRole === ActiveRole.CLIENT
        ? ('subscriptionClientTier' as const)
        : ('subscriptionExpertTier' as const);

    const expiresKey =
      user.activeRole === ActiveRole.CLIENT
        ? ('subClientExpiresAt' as const)
        : ('subExpertExpiresAt' as const);

    const isExpired =
      user[expiresKey] !== null &&
      user[expiresKey] !== undefined &&
      new Date(user[expiresKey]) < new Date();

    return {
      subscriptionTier: isExpired ? 'free' : user[tierKey],
      subscriptionExpires: user[expiresKey],
      isExpired,   
    };
  }
}