import { VAEntityType } from '@common/enums/va-entity-type.enum';
import { VAStatus } from '@common/enums/va-status.enum';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { WalletTopupAmmountDto } from './dto/wallet-topup.dto';

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

  async getTopupWallet(userId: string, walletDto: WalletTopupAmmountDto) {
    const userVirtualAccount = await this.prisma.virtualAccount.findFirst({
      where: {
        entityId: userId,
        entityType: VAEntityType.WALLET_TOPUP,
        status: VAStatus.ACTIVE,
      },
    });

    if (!userVirtualAccount) {
      throw new NotFoundException('Wallet topup virtual account not found!');
    }

    const vaNumber: string = userVirtualAccount.vaNumber.replaceAll('_', '');
    const amount: number = walletDto.amount;

    const qrCodeUrl: string = `https://qr.sepay.vn/img?bank=MBBank&acc=0394654576&template=compact&amount=${amount}&des=${vaNumber}`;

    return {
      qrCodeUrl: qrCodeUrl,
      paymentReference: vaNumber,
    };
  }
}
