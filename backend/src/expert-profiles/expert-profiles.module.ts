import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../database/prisma.module';
import { ExpertProfilesController } from './expert-profiles.controller';
import { ExpertProfileService } from './expert-profiles.service';
import { DomainDepthsController } from './domain-depths.controller';
import { SeamClaimsController } from './seam-claims.controller';

/**
 * §0.11 — Expert Profiles Module
 *
 * Owns all routes under /expert-profiles, /expert-domain-depths, and
 * /expert-seam-claims. Exports ExpertProfileService so that
 * projects/matching.service.ts can later query expert data for the
 * FastAPI /llm/matching payload.
 *
 * §0.11.I endpoints implemented:
 * - GET  /expert-profiles/me
 * - PUT  /expert-profiles/me
 * - POST /expert-domain-depths
 * - PUT  /expert-domain-depths/:id
 * - POST /expert-seam-claims
 */
@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [ExpertProfilesController, DomainDepthsController, SeamClaimsController],
  providers: [ExpertProfileService],
  exports: [ExpertProfileService],
})
export class ExpertProfilesModule {}
