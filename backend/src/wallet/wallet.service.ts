import { VAEntityType } from '@common/enums/va-entity-type.enum';
import { VAStatus } from '@common/enums/va-status.enum';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { WalletTopupAmmountDto } from './dto/wallet-topup.dto';

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

  async getWalletTransaction(
    userId: string,
    filters: { type?: string; limit?: number; offset?: number } = {},
  ) {
    const walletId = await this.getWalletId(userId);
    const transactions = await this.prisma.walletTransaction.findMany({
      where: {
        walletId,
        ...(filters.type ? { transactionType: filters.type } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(filters.limit ?? 50, 100),
      skip: filters.offset ?? 0,
    });

    // Extract milestone IDs from referenceIds
    const milestoneIds = new Set<string>();
    for (const tx of transactions) {
      if (tx.referenceId) {
        const match = tx.referenceId.match(/(?:FEE|REL-C|REL-E|LOCK|REF|SPLIT-C|SPLIT-E)-([0-9a-fA-F-]{36})/);
        if (match) {
          milestoneIds.add(match[1]);
        }
      }
    }

    // Query milestones details in bulk
    const milestones = await this.prisma.milestone.findMany({
      where: { id: { in: Array.from(milestoneIds) } },
      include: {
        engagement: {
          select: {
            type: true,
            service: { select: { title: true } },
            project: { select: { projectName: true } },
          },
        },
      },
    });

    const milestoneMap = new Map(milestones.map(m => [m.id, m]));

    return transactions.map(item => {
      let details: string | null = null;
      if (item.referenceId) {
        const match = item.referenceId.match(/(?:FEE|REL-C|REL-E|LOCK|REF|SPLIT-C|SPLIT-E)-([0-9a-fA-F-]{36})/);
        if (match) {
          const milestoneId = match[1];
          const milestone = milestoneMap.get(milestoneId);
          if (milestone) {
            const isService = milestone.engagement?.type === 'SERVICE_PURCHASE' || milestone.engagement?.type === 'TECH_DISCOVERY';
            const contextName = isService
              ? milestone.engagement?.service?.title
              : milestone.engagement?.project?.projectName;
            
            if (contextName) {
              details = `Milestone #${milestone.milestoneNumber} for ${isService ? 'Service' : 'Project'}: ${contextName}`;
            } else {
              details = `Milestone #${milestone.milestoneNumber}`;
            }
          }
        }
      }

      return {
        id: item.id,
        amount: Number(item.amount),
        transactionType: item.transactionType,
        createdAt: item.createdAt,
        referenceId: item.referenceId,
        details,
      };
    });
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
