import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ElicitationController } from './elicitation.controller';
import { ElicitationService } from './elicitation.service';
import { FastapiClient } from './fastapi.client';
import { PrismaModule } from '../database/prisma.module'; // Import the shared module

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [ElicitationController],
  providers: [ElicitationService, FastapiClient],
  exports: [ElicitationService, FastapiClient],
})
export class ElicitationModule {}
