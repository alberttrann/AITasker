import {
  Injectable,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { TransactionType } from '@common/enums/transaction-type.enum';

const PLACEHOLDER_DISBURSEMENT_MESSAGE =
  'Tiền sẽ được về tài khoản của bạn trong 1-3 ngày làm việc.';

@Injectable()
export class WithdrawalsService {
  constructor(private readonly prisma: PrismaService) {}

  async requestWithdrawal(expertUserId: string, dto: CreateWithdrawalDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: expertUserId },
      select: { sepayBankAccountXid: true },
    });

    if (!user?.sepayBankAccountXid) {
      throw new ConflictException('You must link a bank account before requesting a withdrawal.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: expertUserId },
      });
      if (!wallet) {
        throw new NotFoundException('Wallet not found.');
      }
      if (wallet.availableBalance < dto.amount) {
        throw new UnprocessableEntityException('INSUFFICIENT_BALANCE');
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { availableBalance: { decrement: BigInt(dto.amount) } },
      });

      const withdrawalRequest = await tx.withdrawalRequest.create({
        data: {
          expertId: expertUserId,
          type: 'EXPERT_MANUAL',
          amount: dto.amount,
          bankAccountXid: user.sepayBankAccountXid!,
          status: 'PENDING',
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: BigInt(dto.amount),
          transactionType: TransactionType.WITHDRAWAL,
          referenceId: `WD-${withdrawalRequest.id}`,
        },
      });

      return withdrawalRequest;
    });

    return {
      withdrawal_request_id: result.id,
      status: result.status,
      message: PLACEHOLDER_DISBURSEMENT_MESSAGE,
    };
  }

  async getMyWithdrawals(expertUserId: string) {
    const requests = await this.prisma.withdrawalRequest.findMany({
      where: { expertId: expertUserId },
      orderBy: { requestedAt: 'desc' },
    });
    return requests.map((r) => ({ ...r, amount: Number(r.amount) }));
  }
}
