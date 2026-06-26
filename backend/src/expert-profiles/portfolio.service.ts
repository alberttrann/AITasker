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

  async submit(userId: string, dto: CreatePortfolioSubmissionDto) {
    // 1. Find seam claim.
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
