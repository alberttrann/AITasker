import { Controller, Post, Get, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';

type ActorUser = { id: string; activeRole: string; clientSubtype?: string | null };

@ApiTags('disputes')
@ApiBearerAuth()
@Controller('disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @Roles('CLIENT', 'EXPERT')
  @ApiOperation({ summary: 'File a dispute on an unverified acceptance criterion (milestone must be SUBMITTED or IN_REVISION)' })
  async create(@CurrentUser() user: ActorUser, @Body() dto: CreateDisputeDto) {
    return this.disputesService.create(user.id, dto);
  }

  @Get()
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  @ApiOperation({ summary: 'List disputes — own engagements, or all for ADMIN' })
  async findAll(@CurrentUser() user: ActorUser, @Query('state') state?: string) {
    return this.disputesService.findAll(user, { state });
  }

  @Get(':id')
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  @ApiOperation({ summary: 'View dispute detail' })
  async findById(@Param('id') id: string, @CurrentUser() user: ActorUser) {
    return this.disputesService.findById(id, user);
  }
}