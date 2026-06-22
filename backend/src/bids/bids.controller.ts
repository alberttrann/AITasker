import { Controller, Post, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { BidsService } from './bids.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateBidDto } from './dto/create-bid.dto';
import { UpdateBidDto } from './dto/update-bid.dto';
import { TechReviewDto } from './dto/tech-review.dto';

@Controller('bids')
@UseGuards(JwtAuthGuard, RolesGuard)
// Class-level: all 3 roles can enter the controller. Each method narrows further.
@Roles('CLIENT', 'EXPERT', 'ADMIN')
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  @ApiBearerAuth('JWT')
  @Post()
  // POST /bids is EXPERT-only per docs/04 §0.11 L — override the class-level gate.
  @Roles('EXPERT')
  async create(@CurrentUser() user: { id: string }, @Body() body: CreateBidDto) {
    return this.bidsService.create(user.id, body);
  }

  @ApiBearerAuth('JWT')
  @Get(':id')
  // GET /bids/:id is open to CLIENT, EXPERT, ADMIN (class-level gate).
  // Service does the per-role party check.
  async findById(
    @CurrentUser() user: { id: string; activeRole: string; clientSubtype?: string },
    @Param('id') id: string,
  ) {
    return this.bidsService.findById(id, user);
  }

  @ApiBearerAuth('JWT')
  @Put(':id')
  // PUT /bids/:id (revision loop) is EXPERT-only per docs/04 §0.11 L.
  @Roles('EXPERT')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: UpdateBidDto,
  ) {
    return this.bidsService.update(id, user.id, body);
  }

  @ApiBearerAuth('JWT')
  @Put(':id/tech-review')
  // PUT /bids/:id/tech-review is CLIENT+ (TECH_TEAM subtype checked in service).
  // Class-level @Roles('CLIENT','EXPERT','ADMIN') is too broad; we narrow to CLIENT
  // because the doc says `active_role != CLIENT` → 403. Subtype check is in service.
  @Roles('CLIENT')
  async techReview(
    @CurrentUser() user: { id: string; activeRole: string; clientSubtype?: string },
    @Param('id') id: string,
    @Body() body: TechReviewDto,
  ) {
    return this.bidsService.techReview(id, user, body);
  }
}
