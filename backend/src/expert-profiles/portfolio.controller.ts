import { Controller, Post, Get, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreatePortfolioSubmissionDto } from './dto/create-portfolio-submission.dto';
import { SubscriptionGuard } from '@common/guards/subscription.guard';
/**
 * §0.11.J — Portfolio Submission Controller
 *
 * Handles Tier 2 seam verification evidence:
 * - POST /portfolio-submissions          — submit portfolio for LLM evaluation
 * - GET  /portfolio-submissions/:id      — read submission status + advisory_note
 *
 * POST is EXPERT only with [Pro-E] subscription gate, enforced via SubscriptionGuard.
 *
 * GET allows both EXPERT (own submissions only) and ADMIN (any submission).
 */
@ApiTags('Portfolio Submissions')
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
  @UseGuards(SubscriptionGuard)
  async submit(@CurrentUser() user: { id: string }, @Body() dto: CreatePortfolioSubmissionDto) {
    return this.portfolioService.submit(user.id, dto);
  }

  /**
   * GET /portfolio-submissions
   * Returns all portfolio submissions made by the authenticated expert,
   * newest first. Each item includes the seam code and current verification
   * tier from the linked claim, used to render VerificationHistoryPage.
   */
  @Get()
  @Roles('EXPERT')
  async getMySubmissions(@CurrentUser() user: { id: string }) {
    return this.portfolioService.getMySubmissions(user.id);
  }

  @Get(':id')
  @Roles('EXPERT', 'ADMIN')
  async getById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: { id: string; activeRole: string }) {
    const isAdmin = user.activeRole === 'ADMIN';
    return this.portfolioService.getById(user.id, id, isAdmin);
  }
}
