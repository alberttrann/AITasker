import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}
  // Helper function
  async getWalletId(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId: userId } });

    return wallet.id;
  }

  async getWalletBalance(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: {
        userId: userId,
      },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found!');
    }

    return {
      ...wallet,
      availableBalance: Number(wallet.availableBalance),
      lockedBalance: Number(wallet.lockedBalance),
    };
  }

  async getWalletTransaction(userId: string) {
    const walletId = await this.getWalletId(userId);

    const transactions = await this.prisma.walletTransaction.findMany({
      where: {
        walletId: walletId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return transactions.map((item) => ({
      id: item.id,
      amount: Number(item.amount),
      transactionType: item.transactionType,
      createdAt: item.createdAt,
    }));
  }
}
