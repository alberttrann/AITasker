import { TransactionType } from '@common/enums/transaction-type.enum';
import { ConflictException, Injectable } from '@nestjs/common';
import { log } from 'console';
import { PrismaService } from 'prisma/prisma.service';
@Injectable()
export class IpnHandlerService {
  constructor(private readonly prisma: PrismaService) {}
  async handleIpn(data: any) {
    // Extract fields inside body data
    const content = data.content;
    const transferAmount = BigInt(data.transferAmount);
    const referenceCode = data.referenceCode;

    const contentWords = content.split(' ');
    const paymentReference = contentWords[0];

    // Query to get the user VA Account
    const userVirtualAccount = await this.prisma.virtualAccount.findUnique({
      where: {
        vaNumber: paymentReference,
      },
    });

    if (!userVirtualAccount) {
      throw new ConflictException('This user VANumber is not valid!');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Query to get the user wallet
      const userWallet = await tx.wallet.findUnique({
        where: {
          userId: userVirtualAccount.entityId,
        },
      });

      if (!userWallet) {
        throw new ConflictException('This user wallet is not exist!');
      }

      // Check Idempotency
      const isExistedIdempotency = await tx.walletTransaction.findFirst({
        where: {
          walletId: userWallet.id,
          referenceId: referenceCode,
        },
      });

      if (isExistedIdempotency) {
        return {
          success: true,
          message: 'Already processed',
        };
      }

      // Update wallet balance
      await tx.wallet.update({
        data: {
          availableBalance: {
            increment: transferAmount,
          },
        },
        where: {
          id: userWallet.id,
        },
      });

      // Create new transaction
      await tx.walletTransaction.create({
        data: {
          walletId: userWallet.id,
          amount: transferAmount,
          transactionType: TransactionType.TOP_UP,
          referenceId: referenceCode,
        },
      });

      return { success: true };
    });
  }
}
