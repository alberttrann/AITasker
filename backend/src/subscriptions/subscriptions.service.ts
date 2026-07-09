import { ActiveRole } from '@common/enums/active-role.enum';
import { SubscriptionTier } from '@common/enums/subscription-tier';
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

  async activateSubscription(userId: string, dto: ActivateSubscriptionDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found!');

    const userCurrentActiveRole = dto.activeRole;

    if (user.activeRole !== userCurrentActiveRole) {
      throw new ConflictException(
        'You must switch to the target role before activating a subscription.',
      );
    }

    // Resolve the package the user explicitly chose 
    const pkg = await this.prisma.subscriptionPackage.findUnique({
      where: { id: dto.packageId },
    });

    if (!pkg) {
      throw new NotFoundException(
        `Subscription package ${dto.packageId} not found.`,
      );
    }
    if (!pkg.isActive) {
      throw new UnprocessableEntityException(
        `Package "${pkg.name}" is no longer available. Please choose a different plan.`,
      );
    }
    // Guard against a CEO accidentally sending an Expert packageId and vice-versa
    if (pkg.role !== userCurrentActiveRole) {
      throw new UnprocessableEntityException(
        `Package "${pkg.name}" is for ${pkg.role} accounts but you are activating as ${userCurrentActiveRole}.`,
      );
    }

    const tierKey    = userCurrentActiveRole === ActiveRole.CLIENT
      ? 'subscriptionClientTier'
      : 'subscriptionExpertTier';
    const expiresKey = userCurrentActiveRole === ActiveRole.CLIENT
      ? 'subClientExpiresAt'
      : 'subExpertExpiresAt';
    const roleTypeLabel = userCurrentActiveRole === ActiveRole.CLIENT ? 'client' : 'expert';

    // Idempotency: block if subscription is still active
    const now = new Date();
    const isCurrentlyActive =
      user[tierKey] === SubscriptionTier.PRO &&
      user[expiresKey] !== null &&
      user[expiresKey] > now;

    if (isCurrentlyActive) {
      throw new ConflictException('Your subscription is still active.');
    }

    // Billing transaction 
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const userWallet = await tx.wallet.findUnique({ where: { userId: user.id } });
      if (!userWallet) throw new UnprocessableEntityException('Wallet not found.');

      // Both sides are BigInt — safe comparison
      if (userWallet.availableBalance < pkg.priceVnd) {
        throw new UnprocessableEntityException('INSUFFICIENT_BALANCE');
      }

      await tx.wallet.update({
        where: { userId: user.id },
        data:  { availableBalance: { decrement: pkg.priceVnd } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId:        userWallet.id,
          amount:          pkg.priceVnd,
          transactionType: TransactionType.SUBSCRIPTION,
          referenceId:     `SUB-${userId}:${roleTypeLabel}:${pkg.id}:${Date.now()}`,
        },
      });

      const expiresAt = addMonths(now, pkg.durationMonths);

      // Purchase log (for subscription history)
      await tx.subscriptionPurchaseLog.create({
        data: {
          userId:        user.id,
          packageId:     pkg.id,
          role:          userCurrentActiveRole,
          amountPaidVnd: pkg.priceVnd,
          expiresAt,
          paymentMethod: 'WALLET',
        },
      });

      return tx.user.update({
        where: { id: user.id },
        data: {
          [tierKey]:    SubscriptionTier.PRO,
          [expiresKey]: expiresAt,
        },
      });
    });

    this.eventEmitter.emit('socket.broadcast', {
      userId: user.id,
      event:  'notification:generic',
      payload: {
        type:  'system',
        title: 'Pro Activated',
        body:  `Welcome to ${pkg.name}! Valid for ${pkg.durationMonths} month(s).`,
      },
    });

    const access_token = await this.authService.jwtGeneratePayload(updatedUser);
    return {
      access_token,
      activatedPackage: {
        name:           pkg.name,
        priceVnd:       pkg.priceVnd.toString(),
        durationMonths: pkg.durationMonths,
      },
    };
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
  async getSubscriptionHistory(userId: string) {
    const logs = await this.prisma.subscriptionPurchaseLog.findMany({
      where: { userId },
      orderBy: { purchasedAt: 'desc' },
      include: {
        package: {
          select: { name: true, role: true, durationMonths: true },
        },
      },
    });

    return logs.map((log) => ({
      id:            log.id,
      packageName:   log.package.name,
      role:          log.role,
      amountPaidVnd: log.amountPaidVnd.toString(),
      purchasedAt:   log.purchasedAt,
      expiresAt:     log.expiresAt,
      paymentMethod: log.paymentMethod,
      isExpired:     log.expiresAt < new Date(),
    }));
  }
}