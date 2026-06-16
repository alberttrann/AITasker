import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}
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
}
