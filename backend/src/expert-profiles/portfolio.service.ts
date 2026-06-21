import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { FastapiClient } from '../elicitation/fastapi.client';
import { CreatePortfolioSubmissionDto } from './dto/create-portfolio-submission.dto';

/**
 * §0.11.J — Portfolio Submission Service
 *
 * Owns the Tier 2 seam verification flow:
 * - submit() — POST /portfolio-submissions — calls FastAPI /llm/portfolio-eval,
 *   atomically updates portfolio_submissions + expert_seam_claims + platform_decisions
 * - getById() — GET /portfolio-submissions/:id — joins platform_decisions for advisory_note
 *
 * Atomic transaction is required (per §0.11.J): all three table writes must succeed
 * or roll back together. Otherwise an LLM eval succeeds but the seam claim never
 * upgrades (or vice versa).
 */
@Injectable()
export class PortfolioService {
  // Maximum submission attempts before 30-day lockout per BR-VER-06
  private static readonly MAX_ATTEMPTS = 5;

  // Lockout window in days per BR-VER-06
  private static readonly LOCKOUT_DAYS = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fastapi: FastapiClient,
  ) {}

  /**
   * §0.11.J — POST /portfolio-submissions
   *
   * Submits portfolio evidence for Tier 2 verification of a seam claim.
   *
   * Flow:
   * 1. [Pro-E] subscription gate — query user.subscription_expert_tier
   *    (TODO: replace with SubscriptionGuard once Chí Nhân implements it).
   * 2. Find seam claim by id → 404 if missing, 403 if not owner.
   * 3. Verify claim is at CLAIMED tier → 422 ALREADY_VERIFIED_OR_HIGHER.
   * 4. Verify not in lockout → 429 TOO_MANY_ATTEMPTS with lockedUntil.
   * 5. Create portfolio_submissions row at PENDING.
   * 6. Call FastAPI /llm/portfolio-eval.
   * 7. Atomic TX: update submission status, update seam claim (tier upgrade
   *    OR submission_count++ with possible 30-day lock), insert platform_decisions.
   *
   * Returns 201 with { id, status, llmConfidence, evaluationTierUpgraded,
   * advisoryNote, evaluatedAt }.
   */
  async submit(userId: string, dto: CreatePortfolioSubmissionDto) {
    // 1. [Pro-E] subscription gate — service-level until SubscriptionGuard exists.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionExpertTier: true,
        subExpertExpiresAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (
      user.subscriptionExpertTier !== 'pro' ||
      !user.subExpertExpiresAt ||
      user.subExpertExpiresAt < new Date()
    ) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_REQUIRED',
        message: 'Expert Pro subscription required to submit portfolio evidence',
      });
    }

    // 2. Find seam claim.
    const claim = await this.prisma.expertSeamClaim.findUnique({
      where: { id: dto.seamClaimId },
      select: {
        expertId: true,
        seamCode: true,
        verificationTier: true,
        submissionCount: true,
        lockedUntil: true,
      },
    });

    if (!claim) {
      throw new NotFoundException('Seam claim not found');
    }

    // 3. Owner check.
    if (claim.expertId !== userId) {
      throw new ForbiddenException('You are not the owner of this seam claim');
    }

    // 4. State check — must be at CLAIMED to upgrade.
    if (claim.verificationTier !== 'CLAIMED') {
      throw new UnprocessableEntityException({
        code: 'ALREADY_VERIFIED_OR_HIGHER',
        message: 'Target seam is already at EVIDENCE_BACKED or higher',
      });
    }

    // 5. Lockout check.
    if (claim.lockedUntil && claim.lockedUntil > new Date()) {
      throw new HttpException(
        {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Too many failed verification attempts — locked out',
          lockedUntil: claim.lockedUntil.toISOString(),
        },
        429,
      );
    }

    // 6. Submission count check (defensive — should already be locked).
    if (claim.submissionCount >= PortfolioService.MAX_ATTEMPTS) {
      throw new HttpException(
        {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Maximum verification attempts exceeded',
          lockedUntil: claim.lockedUntil?.toISOString() ?? null,
        },
        429,
      );
    }

    // 7. Create submission row at PENDING.
    const submission = await this.prisma.portfolioSubmission.create({
      data: {
        expertId: userId,
        seamClaimId: dto.seamClaimId,
        projectDescription: dto.projectDescription,
        decisionPoints: dto.decisionPoints,
      },
    });

    // 8. Call FastAPI /llm/portfolio-eval.
    let evalResult;
    try {
      evalResult = await this.fastapi.portfolioEval({
        seam_code: claim.seamCode,
        project_description: dto.projectDescription,
        decision_points: dto.decisionPoints,
      });
    } catch (err) {
      // FastAPI returned 5xx. Submission stays PENDING; client can retry.
      throw new ServiceUnavailableException('LLM service unavailable — retry in a moment');
    }

    // 9. Atomic TX: update submission + seam claim + insert platform_decisions.
    // Trust passed_boolean — FastAPI computes it from settings.portfolio_eval_threshold
    // (configurable; default 0.85). NestJS does not re-check to avoid drift if the
    // FastAPI config is raised above 0.85.
    const passed = evalResult.passed_boolean;
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedSubmission = await tx.portfolioSubmission.update({
        where: { id: submission.id },
        data: {
          status: passed ? 'APPROVED' : 'REJECTED',
          llmConfidence: evalResult.confidence_score,
          evaluatedAt: new Date(),
        },
      });

      let tierUpgraded = false;

      if (passed) {
        // Per BR-VER-03 + BR-VER-04: automatic Tier 2 upgrade on pass.
        await tx.expertSeamClaim.update({
          where: { id: dto.seamClaimId },
          data: { verificationTier: 'EVIDENCE_BACKED' },
        });

        await tx.platformDecision.create({
          data: {
            decisionType: 'SEAM_TIER_UPGRADE',
            entityType: 'expert_seam_claims',
            entityId: dto.seamClaimId,
            llmConfidence: evalResult.confidence_score,
            decision: 'UPGRADED',
            advisoryNote: evalResult.gap_advisory,
          },
        });

        tierUpgraded = true;
      } else {
        // Per BR-VER-06: increment count + 30-day lockout on 5th fail.
        const newCount = claim.submissionCount + 1;
        const updateData: Prisma.ExpertSeamClaimUpdateInput = {
          submissionCount: newCount,
        };

        if (newCount >= PortfolioService.MAX_ATTEMPTS) {
          const lockedUntil = new Date();
          lockedUntil.setDate(lockedUntil.getDate() + PortfolioService.LOCKOUT_DAYS);
          updateData.lockedUntil = lockedUntil;
        }

        await tx.expertSeamClaim.update({
          where: { id: dto.seamClaimId },
          data: updateData,
        });

        await tx.platformDecision.create({
          data: {
            decisionType: 'PORTFOLIO_EVAL',
            entityType: 'portfolio_submissions',
            entityId: submission.id,
            llmConfidence: evalResult.confidence_score,
            decision: 'REJECTED',
            advisoryNote: evalResult.gap_advisory,
          },
        });
      }

      return { submission: updatedSubmission, tierUpgraded };
    });

    return {
      id: result.submission.id,
      status: result.submission.status,
      llmConfidence: result.submission.llmConfidence,
      evaluationTierUpgraded: result.tierUpgraded,
      advisoryNote: evalResult.gap_advisory,
      evaluatedAt: result.submission.evaluatedAt,
    };
  }

  /**
   * §0.11.J — GET /portfolio-submissions/:id
   *
   * Returns the submission's status, llm_confidence, and the most recent
   * platform_decisions.advisory_note for the entity. ADMIN can read any
   * submission; EXPERT can only read their own.
   *
   * R: portfolio_submissions, platform_decisions.
   */
  async getById(userId: string, id: string, isAdmin: boolean) {
    const submission = await this.prisma.portfolioSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException('Portfolio submission not found');
    }

    if (!isAdmin && submission.expertId !== userId) {
      throw new ForbiddenException('You are not the owner of this submission');
    }

    // Most recent platform_decisions row for this submission entity.
    const decision = await this.prisma.platformDecision.findFirst({
      where: {
        entityType: 'portfolio_submissions',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      id: submission.id,
      seamClaimId: submission.seamClaimId,
      status: submission.status,
      llmConfidence: submission.llmConfidence,
      advisoryNote: decision?.advisoryNote ?? null,
      submittedAt: submission.submittedAt,
      evaluatedAt: submission.evaluatedAt,
    };
  }
}
