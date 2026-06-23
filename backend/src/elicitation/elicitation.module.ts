// backend/src/elicitation/elicitation.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ElicitationController } from './elicitation.controller';
import { ElicitationService } from './elicitation.service';
import { FastapiClientModule } from './fastapi-client.module';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MatchingHelperModule } from '../shared/matching/matching-helper.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    FastapiClientModule,     // CHANGED: was providing FastapiClient directly
    AuthModule,               // ADDED: for AuthService (setSelfTechnical re-sign)
    MatchingHelperModule,     // ADDED: for precheckCandidateCount
  ],
  controllers: [ElicitationController],
  providers: [ElicitationService],
  exports: [ElicitationService, FastapiClientModule],
})
export class ElicitationModule {}