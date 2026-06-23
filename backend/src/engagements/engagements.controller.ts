import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { EngagementsService } from './engagements.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@Controller('engagements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENT', 'EXPERT', 'ADMIN')
export class EngagementsController {
  constructor(private readonly engagementsService: EngagementsService) {}

  // GET /engagements — list own engagements (ADMIN sees all).
  // Blueprint: docs/04-endpoints.md §0.11 L row 145.
  @ApiBearerAuth('JWT')
  @Get()
  async findAll(
    @CurrentUser() user: { id: string; activeRole: string; clientSubtype?: string },
    @Query('state') state?: string,
    @Query('type') type?: string,
    @Query('connectedAt') connectedAt?: string,
  ) {
    return this.engagementsService.findAll(user, { state, type, connectedAt });
  }
}
