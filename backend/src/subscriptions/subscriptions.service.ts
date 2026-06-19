import { ActiveRole } from '@common/enums/active-role.enum';
import { SubscriptionTier } from '@common/enums/subscription-tier';
import { SubscriptionPrice } from '@common/enums/subscription-price.enum';
import { TransactionType } from '@common/enums/transaction-type.enum';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ActivateSubscriptionDto } from 'src/subscriptions/dto/activate-subscription.dto';
import { addMonths } from 'date-fns';
import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async activateSubscription(userId: string, activateSubscriptionDto: ActivateSubscriptionDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
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

    /*
      Method using here: Dynamic Access
      - Instead of using user.subscriptionClientTier or user.subscriptionExpertTier to access the tier or the expired time -> this cause the code to be longer and hard to maintain logic

      - Therfore, we use Dynamic Access here which is user[the key]
      - By using this, we only need to process what is the value of the key so that we can shortly access to the value of the column we want (this equals to user.subscriptionClientTier if the key is equals to subscriptionClientTier) avoiding the condition overcheck
    
    */

    const tierKey =
      userCurrentActiveRole === ActiveRole.CLIENT
        ? 'subscriptionClientTier'
        : 'subscriptionExpertTier';

    const expiresKey =
      userCurrentActiveRole === ActiveRole.CLIENT ? 'subClientExpiresAt' : 'subExpertExpiresAt';

    const currentTime = new Date();
    if (user[tierKey] === SubscriptionTier.PRO || user[expiresKey] > currentTime) {
      throw new ConflictException('Your subscription is still available');
    }

    // DB transaction to make sure every steps is successfully proccessed, rollback immediately if any step is error
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const userWallet = await tx.wallet.findUnique({
        where: {
          userId: user.id,
        },
      });

      if (userWallet.availableBalance < SubscriptionPrice.PRO_PRICE) {
        throw new ConflictException('Your available balance is not enough!');
      }

      // Decrease wallet balance
      await tx.wallet.update({
        where: {
          userId: user.id,
        },
        data: {
          availableBalance: {
            decrement: SubscriptionPrice.PRO_PRICE,
          },
        },
      });

      // Record transaction
      await tx.walletTransaction.create({
        data: {
          walletId: userWallet.id,
          amount: BigInt(SubscriptionPrice.PRO_PRICE),
          transactionType: TransactionType.SUBSCRIPTION,
          referenceId: userId,
        },
      });

      // Update tier and expiration time
      return tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          [tierKey]: SubscriptionTier.PRO,
          [expiresKey]: addMonths(new Date(), 6),
        },
      });
    });

    // Reissue the new JWT
    const access_token = await this.authService.jwtGeneratePayload(updatedUser);

    return access_token;
  }
}
