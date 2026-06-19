import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../database/prisma.module';
import { ExpertProfilesController } from './expert-profiles.controller';
import { ExpertProfileService } from './expert-profiles.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [ExpertProfilesController],
  providers: [ExpertProfileService],
  exports: [ExpertProfileService],
})
export class ExpertProfilesModule {}
