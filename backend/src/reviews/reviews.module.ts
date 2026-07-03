import { Module } from '@nestjs/common';
import { ReviewController } from './reviews.controller';
import { ReviewService } from './reviews.service';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  controllers: [ReviewController],
  providers: [ReviewService, PrismaService],
})
export class ReviewsModule {}
