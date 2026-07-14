import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
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
  ) { }

  // PUT /admin/projects/:id/suspend-spec
  async suspendSpec(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Project not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id: projectId },
        data: { state: 'SUSPENDED' }
      });

      await tx.platformDecision.create({
        data: {
          decisionType: 'SPEC_AUTO_RETURN',
          entityType: 'projects',
          entityId: projectId,
          decision: 'SUSPENDED',
          advisoryNote: 'Admin suspension',
        }
      });

      return updated;
    });
  }

  // PUT /admin/users/:id/suspend
  async suspendUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }

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
        ...(filters?.entityType ? { entityType: filters.entityType } : {}),
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
      id: t.id,
      amount: Number(t.amount),
      transactionType: t.transactionType,
      referenceId: t.referenceId,
      createdAt: t.createdAt,
      userEmail: t.wallet.user.email,
      userFullName: t.wallet.user.fullName,
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
      elicitation_completion_rate_pct: safeRate(completedSessions, totalSessions),
      portfolio_auto_upgrade_rate_pct: safeRate(approvedPortfolioSubmissions, totalPortfolioSubmissions),
      dispute_rate_pct: safeRate(totalDisputes, totalMilestones),
      dispute_auto_resolve_rate_pct: safeRate(autoResolvedDisputes, totalDisputes),
      milestone_completion_rate_pct: safeRate(releasedMilestones, totalMilestones),
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
          walletId: wallet.id,
          amount: withdrawal.amount,
          transactionType: TransactionType.WITHDRAWAL,
          referenceId: `WD-${withdrawal.id}-REVERSAL`,
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

  // ── F-1: Subscription Package Management ───────────────────────────────
  async listSubscriptionPackages() {
    return this.prisma.subscriptionPackage.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createSubscriptionPackage(dto: {
    role: string;
    name: string;
    priceVnd: number;
    durationMonths: number;
  }) {
    return this.prisma.subscriptionPackage.create({
      data: {
        role: dto.role,
        name: dto.name,
        priceVnd: BigInt(dto.priceVnd),
        durationMonths: dto.durationMonths,
      },
    });
  }

  async updateSubscriptionPackage(
    packageId: string,
    dto: { priceVnd?: number; durationMonths?: number; name?: string; isActive?: boolean },
  ) {
    const pkg = await this.prisma.subscriptionPackage.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Subscription package not found.');
    return this.prisma.subscriptionPackage.update({
      where: { id: packageId },
      data: {
        ...(dto.priceVnd !== undefined && { priceVnd: BigInt(dto.priceVnd) }),
        ...(dto.durationMonths !== undefined && { durationMonths: dto.durationMonths }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  // ── User Management ───────────────────────────────────────────────
  async getUsers(limit?: number, offset?: number) {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        roles: true,
        activeRole: true,
        clientSubtype: true,
        subscriptionClientTier: true,
        subscriptionExpertTier: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit ?? 100,
      skip: offset ?? 0,
    });
  }

  async reactivateUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });
  }

  // ── Platform Settings ──────────────────────────────────────────────
  async getPlatformSettings() {
    const settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      // Return safe defaults if no row exists yet
      return { platform_fee_pct: 0.05, platform_wallet_id: null };
    }
    return {
      platform_fee_pct: settings.platformFeePct,
      platform_wallet_id: settings.platformWalletId,
    };
  }

  async updatePlatformSettings(dto: { platform_fee_pct?: number; platform_wallet_id?: string }) {
    // Guard: platform_fee_pct must be in [0, 1] — values > 1 would produce negative expertAmount
    // in ledger.service.ts, causing BigInt(negative) to corrupt the wallet.
    if (dto.platform_fee_pct !== undefined && (dto.platform_fee_pct < 0 || dto.platform_fee_pct > 1)) {
      throw new BadRequestException('platform_fee_pct must be between 0 and 1 (inclusive)');
    }

    const existing = await this.prisma.platformSettings.findFirst();
    if (!existing) {
      const created = await this.prisma.platformSettings.create({
        data: {
          platformFeePct: dto.platform_fee_pct ?? 0.05,
          platformWalletId: dto.platform_wallet_id ?? null,
        },
      });
      return { platform_fee_pct: created.platformFeePct, platform_wallet_id: created.platformWalletId };
    }
    const updated = await this.prisma.platformSettings.update({
      where: { id: existing.id },
      data: {
        ...(dto.platform_fee_pct !== undefined && { platformFeePct: dto.platform_fee_pct }),
        ...(dto.platform_wallet_id !== undefined && { platformWalletId: dto.platform_wallet_id }),
      },
    });
    return { platform_fee_pct: updated.platformFeePct, platform_wallet_id: updated.platformWalletId };
  }

  async deleteSubscriptionPackage(packageId: string) {
    const pkg = await this.prisma.subscriptionPackage.findUnique({
      where: { id: packageId },
      include: { _count: { select: { purchaseLogs: true } } },
    });

    if (!pkg) {
      throw new NotFoundException('Subscription package not found.');
    }

    if (pkg._count.purchaseLogs > 0) {
      throw new UnprocessableEntityException(
        `Cannot delete "${pkg.name}" — it has ${pkg._count.purchaseLogs} purchase record(s) ` +
        `linked to it. Deactivate it instead (PUT /admin/subscriptions/packages/${packageId} ` +
        `with { "isActive": false }) to hide it from new activations without losing history.`,
      );
    }

    await this.prisma.subscriptionPackage.delete({ where: { id: packageId } });
    return { deleted: true, id: packageId, name: pkg.name };
  }

  async listUsers(filters: { role?: string; isActive?: boolean; search?: string }) {
    const where: any = {};
    
    // Exact boolean match (if provided)
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    
    // JSON Array match for role (e.g. 'CLIENT_CEO', 'EXPERT', 'ADMIN')
    if (filters.role) {
      where.roles = { array_contains: filters.role }; // ← FIXED
    }

    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { fullName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    
    return this.prisma.user.findMany({
      where,
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, email: true, fullName: true, roles: true,
        activeRole: true, isActive: true, createdAt: true,
        subscriptionClientTier: true, subscriptionExpertTier: true,
      },
    });
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallet: { select: { availableBalance: true, lockedBalance: true } },
        clientProfile: true, expertProfile: true,
      },
    });
    if (!user) throw new NotFoundException('User not found.');
    return {
      ...user,
      wallet: user.wallet
        ? { availableBalance: Number(user.wallet.availableBalance), lockedBalance: Number(user.wallet.lockedBalance) }
        : null,
    };
  }



  async listProjects(filters: { state?: string; archetype?: string }) {
    return this.prisma.project.findMany({
      where: {
        ...(filters.state ? { state: filters.state } : {}),
        ...(filters.archetype ? { archetype: filters.archetype } : {}),
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, projectName: true, state: true, archetype: true,
        tier: true, createdAt: true, clientId: true,
      },
    });
  }


  async getProjectDetail(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: { select: { id: true, fullName: true, email: true } },
        techTeamProfiles: { include: { user: { select: { id: true, fullName: true } } } },
        _count: { select: { invitations: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found.');
    return {
      ...project,
      estimatedTotalCostVnd: project.estimatedTotalCostVnd?.toString() ?? null,
    };
  }

  async listEngagements(filters: { state?: string; projectId?: string }) {
    return this.prisma.engagement.findMany({
      where: {
        ...(filters.state ? { state: filters.state } : {}),
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
      },
      include: {
        project: { select: { id: true, projectName: true } },
        expert: { select: { id: true, fullName: true, email: true } },
        client: { select: { id: true, fullName: true, email: true } },
        _count: { select: { milestones: true } },
      },
      orderBy: { id: 'desc' },
      take: 100,
    });
  }

  async listExperts(filters: { verificationTier?: string; limit?: number }) {
    const experts = await this.prisma.user.findMany({
      where: {
        roles: { array_contains: 'EXPERT' },
        expertProfile: { isNot: null },
      },
      take: Math.min(filters.limit ?? 50, 100),
      include: {
        expertSeamClaims: { select: { seamCode: true, verificationTier: true } },
        expertDomainDepths: { select: { domainCode: true, depthLevel: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return experts;
  }

  async reopenProject(projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found.');
    if (project.state !== 'SUSPENDED') {
      throw new UnprocessableEntityException(`Project is in state '${project.state}', not SUSPENDED.`);
    }
    return this.prisma.project.update({
      where: { id: projectId },
      data: { state: 'PUBLISHED' },
    });
  }
}