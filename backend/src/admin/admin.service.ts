import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { DisputesService } from '../disputes/disputes.service';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { DisputeResolution } from '../disputes/dto/resolve-dispute.dto';
import { TransactionType } from '@common/enums/transaction-type.enum';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly disputesService: DisputesService,
  ) {}


  async getDisputesQueue(adminUserId: string, state?: string) {
    return this.disputesService.findAll(
      { id: adminUserId, activeRole: 'ADMIN' },
      { state },
    );
  }

  async resolveDispute(disputeId: string, dto: ResolveDisputeDto, adminUserId: string) {
    const resolution: DisputeResolution = {
      decision: dto.decision,
    };
    await this.disputesService.applyResolution(disputeId, resolution, undefined, adminUserId);
    return { success: true };
  }


  // GET /admin/decisions
  async getDecisions(filters?: { decisionType?: string; entityType?: string }) {
    return this.prisma.platformDecision.findMany({
      where: {
        ...(filters?.decisionType ? { decisionType: filters.decisionType } : {}),
        ...(filters?.entityType   ? { entityType: filters.entityType }     : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // GET /admin/transactions
  async getTransactions(filters?: { type?: string; userId?: string }) {
    const transactions = await this.prisma.walletTransaction.findMany({
      where: {
        ...(filters?.type ? { transactionType: filters.type } : {}),
        ...(filters?.userId ? { wallet: { userId: filters.userId } } : {}),
      },
      include: {
        wallet: {
          select: {
            user: { select: { email: true, fullName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return transactions.map((t) => ({
      id:               t.id,
      amount:           Number(t.amount),
      transactionType:  t.transactionType,
      referenceId:      t.referenceId,
      createdAt:        t.createdAt,
      userEmail:        t.wallet.user.email,
      userFullName:     t.wallet.user.fullName,
    }));
  }

  // GET /admin/analytics
  async getAnalytics() {
    const [
      projectsByArchetype,
      totalSessions,
      completedSessions,
      totalPortfolioSubmissions,
      approvedPortfolioSubmissions,
      totalDisputes,
      autoResolvedDisputes,
      totalMilestones,
      releasedMilestones,
    ] = await Promise.all([
      this.prisma.project.groupBy({
        by: ['archetype', 'tier'],
        _count: true,
        where: { state: 'PUBLISHED' },
      }),
      this.prisma.elicitationSession.count(),
      this.prisma.elicitationSession.count({ where: { state: 'COMPLETED' } }),
      this.prisma.portfolioSubmission.count(),
      this.prisma.portfolioSubmission.count({ where: { status: 'APPROVED' } }),
      this.prisma.dispute.count(),
      this.prisma.dispute.count({ where: { state: 'AUTO_RESOLVED' } }),
      this.prisma.milestone.count(),
      this.prisma.milestone.count({ where: { state: 'RELEASED' } }),
    ]);

    const safeRate = (numerator: number, denominator: number) =>
      denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0;

    return {
      active_projects_by_archetype_tier: projectsByArchetype,
      elicitation_completion_rate_pct:   safeRate(completedSessions, totalSessions),
      portfolio_auto_upgrade_rate_pct:   safeRate(approvedPortfolioSubmissions, totalPortfolioSubmissions),
      dispute_rate_pct:                  safeRate(totalDisputes, totalMilestones),
      dispute_auto_resolve_rate_pct:     safeRate(autoResolvedDisputes, totalDisputes),
      milestone_completion_rate_pct:     safeRate(releasedMilestones, totalMilestones),
    };
  }

  async completeWithdrawal(withdrawalId: string) {
    const withdrawal = await this.prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });
    if (!withdrawal) {
      throw new NotFoundException('Withdrawal request not found.');
    }
    if (withdrawal.status !== 'PENDING') {
      throw new ConflictException(`Withdrawal is in status ${withdrawal.status}; cannot complete.`);
    }
 
    if (withdrawal.type !== 'MILESTONE_RELEASE' || !withdrawal.milestoneId) {
      return this.prisma.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: { status: 'COMPLETED', confirmedAt: new Date() },
      });
    }
 
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: { status: 'COMPLETED', confirmedAt: new Date() },
      });
 
      const milestone = await tx.milestone.findUnique({
        where: { id: withdrawal.milestoneId! },
      });
 
      if (milestone && milestone.state === 'APPROVED') {
        await tx.milestone.update({
          where: { id: milestone.id },
          data: { state: 'RELEASED', releasedAt: new Date() },
        });
 
        const unreleased = await tx.milestone.count({
          where: { engagementId: milestone.engagementId, state: { not: 'RELEASED' } },
        });
 
        if (unreleased === 0) {
          await tx.engagement.update({
            where: { id: milestone.engagementId },
            data: { state: 'CLOSED' },
          });
        }
      }
 
      return updated;
    });
  }

  async failWithdrawal(withdrawalId: string) {
    const withdrawal = await this.prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
    });
    if (!withdrawal) {
      throw new NotFoundException('Withdrawal request not found.');
    }
    if (withdrawal.status !== 'PENDING') {
      throw new ConflictException(`Withdrawal is in status ${withdrawal.status}; cannot fail.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId: withdrawal.expertId } });
      if (!wallet) {
        throw new NotFoundException('Wallet not found.');
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { availableBalance: { increment: withdrawal.amount } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId:        wallet.id,
          amount:          withdrawal.amount,
          transactionType: TransactionType.WITHDRAWAL,
          referenceId:     `WD-${withdrawal.id}-REVERSAL`,
        },
      });

      return tx.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: { status: 'FAILED' },
      });
    });
  }

  // GET /admin/withdrawals — queue for the actions above
  async getWithdrawalsQueue(status?: string) {
    return this.prisma.withdrawalRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { requestedAt: 'desc' },
    });
  }
}