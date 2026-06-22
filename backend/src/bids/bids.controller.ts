import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { BidsService } from './bids.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateBidDto } from './dto/create-bid.dto';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('bids')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('EXPERT')
export class BidsController {
  constructor(private readonly bidsService: BidsService) {}

  @ApiBearerAuth('JWT')
  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() body: CreateBidDto) {
    return this.bidsService.create(user.id, body);
  }
}
