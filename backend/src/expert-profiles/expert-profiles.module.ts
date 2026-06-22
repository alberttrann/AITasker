import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../database/prisma.module';
import { ElicitationModule } from '../elicitation/elicitation.module';
import { ExpertProfilesController } from './expert-profiles.controller';
import { ExpertProfileService } from './expert-profiles.service';
import { DomainDepthsController } from './domain-depths.controller';
import { SeamClaimsController } from './seam-claims.controller';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';

/**
 * §0.11 — Expert Profiles Module
 *
 * Owns all routes under /expert-profiles, /expert-domain-depths,
 * /expert-seam-claims, and /portfolio-submissions. Exports
 * ExpertProfileService so that projects/matching.service.ts can later
 * query expert data for the FastAPI /llm/matching payload.
 *
 * Imports ElicitationModule to reuse FastapiClient (portfolio service
 * calls FastAPI /llm/portfolio-eval for Tier 2 seam verification).
 *
 * §0.11.I + J endpoints implemented:
 * - GET  /expert-profiles/me
 * - PUT  /expert-profiles/me
 * - POST /expert-domain-depths
 * - PUT  /expert-domain-depths/:id
 * - POST /expert-seam-claims
 * - POST /portfolio-submissions
 * - GET  /portfolio-submissions/:id
 */
@Module({
  imports: [PrismaModule, ConfigModule, ElicitationModule],
  controllers: [
    ExpertProfilesController,
    DomainDepthsController,
    SeamClaimsController,
    PortfolioController,
  ],
  providers: [ExpertProfileService, PortfolioService],
  exports: [ExpertProfileService],
})
export class ExpertProfilesModule {}
