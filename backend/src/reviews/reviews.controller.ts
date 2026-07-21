import { Roles } from '@common/decorators/roles.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ReviewService } from './reviews.service';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CreateReviewDto } from './dto/create-review.dto';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { AuthUser } from 'src/auth/strategies/jwt.strategy';

@ApiTags('Reviews')
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

  @ApiBearerAuth('JWT')
  @Get(':engagementId')
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  getAllReview(@Param('engagementId') engagementId: string, @CurrentUser() user: AuthUser) {
    return this.reviewService.getAllReview(user.id, engagementId);
  }

  @ApiBearerAuth('JWT')
  @Get('users/:userId')
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  @ApiOperation({ summary: 'Get all reviews for a specific user (public profile)' })
  async getReviewsForUser(@Param('userId') userId: string) {
    return this.reviewService.getReviewsForUser(userId);
  }

  @ApiBearerAuth('JWT')
  @Get('me')
  @Roles('CLIENT', 'EXPERT')
  @ApiOperation({ summary: 'Reviews I have written (as reviewer)' })
  async getMyReviews(@CurrentUser() user: AuthUser) {
    return this.reviewService.getReviewsByReviewer(user.id);
  }

  @ApiBearerAuth('JWT')
  @Get('me/received')
  @Roles('CLIENT', 'EXPERT')
  @ApiOperation({ summary: 'Reviews I have received (as target)' })
  async getMyReceivedReviews(@CurrentUser() user: AuthUser) {
    return this.reviewService.getReviewsForUser(user.id);
  }
}
