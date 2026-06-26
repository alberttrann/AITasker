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
