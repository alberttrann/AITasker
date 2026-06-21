import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreatePortfolioSubmissionDto } from './dto/create-portfolio-submission.dto';

/**
 * §0.11.J — Portfolio Submission Controller
 *
 * Handles Tier 2 seam verification evidence:
 * - POST /portfolio-submissions          — submit portfolio for LLM evaluation
 * - GET  /portfolio-submissions/:id      — read submission status + advisory_note
 *
 * POST is EXPERT only with [Pro-E] subscription gate (enforced in service
 * until SubscriptionGuard is implemented).
 *
 * GET allows both EXPERT (own submissions only) and ADMIN (any submission).
 */
@Controller('portfolio-submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  /**
   * §0.11.J — POST /portfolio-submissions
   *
   * Submits portfolio evidence for Tier 2 verification. Calls FastAPI
   * /llm/portfolio-eval and atomically updates submission + seam claim +
   * platform_decisions.
   *
   * - 201: success (with evaluationTierUpgraded flag).
   * - 403: not EXPERT, not subscription Pro, or not owner of seam claim.
   * - 404: seam claim not found.
   * - 422: target seam already at EVIDENCE_BACKED or higher.
   * - 429: locked out due to too many failed attempts.
   * - 503: FastAPI /llm/portfolio-eval unavailable.
   */
  @Post()
  @Roles('EXPERT')
  async submit(@CurrentUser() user: { id: string }, @Body() dto: CreatePortfolioSubmissionDto) {
    return this.portfolioService.submit(user.id, dto);
  }

  /**
   * §0.11.J — GET /portfolio-submissions/:id
   *
   * Returns submission status, llm_confidence, and the most recent
   * platform_decisions.advisory_note. EXPERT can only read their own;
   * ADMIN can read any.
   *
   * - 403: not owner and not ADMIN.
   * - 404: submission not found.
   */
  @Get(':id')
  @Roles('EXPERT', 'ADMIN')
  async getById(@Param('id') id: string, @CurrentUser() user: { id: string; activeRole: string }) {
    const isAdmin = user.activeRole === 'ADMIN';
    return this.portfolioService.getById(user.id, id, isAdmin);
  }
}
