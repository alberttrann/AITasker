import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { ConfigReadService } from './config.service';
import { PrismaModule } from '../database/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ConfigController],
  providers: [ConfigReadService],
  exports: [ConfigReadService],
})
export class AppConfigModule {}