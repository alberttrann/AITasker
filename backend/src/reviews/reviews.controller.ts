import { Roles } from '@common/decorators/roles.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ReviewService } from './reviews.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CreateReviewDto } from './dto/create-review.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthUser } from 'src/auth/strategies/jwt.strategy';

@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @ApiBearerAuth('JWT')
  @Post('')
  @Roles('CLIENT', 'EXPERT')
  createReview(@CurrentUser() user: AuthUser, @Body() createReviewDto: CreateReviewDto) {
    return this.reviewService.createReview(user.id, createReviewDto);
  }
}
