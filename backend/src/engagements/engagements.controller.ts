import { Controller, Get, Param, ParseUUIDPipe, Put, Query, UseGuards } from '@nestjs/common';
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
    @CurrentUser() user: { id: string; activeRole: string; clientSubtype: string | null },
    @Query('state') state?: string,
    @Query('type') type?: string,
    @Query('connectedAt') connectedAt?: string,
  ) {
    return this.engagementsService.findAll(user, { state, type, connectedAt });
  }

  // GET /engagements/:id — full engagement detail.
  // Blueprint: docs/04-endpoints.md §0.11 L row 146.
  @ApiBearerAuth('JWT')
  @Get(':id')
  async findById(
    @CurrentUser() user: { id: string; activeRole: string; clientSubtype: string | null },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.engagementsService.findById(id, user);
  }

  // PUT /engagements/:id/nda — CEO accepts NDA.
  // Blueprint: docs/04-endpoints.md §0.11 L row 147.
  @ApiBearerAuth('JWT')
  @Put(':id/nda')
  async acceptNda(
    @CurrentUser() user: { id: string; activeRole: string; clientSubtype: string | null },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.engagementsService.acceptNda(id, user);
  }

  // PUT /engagements/:id/connect — expert accepts connection + NDA.
  // Blueprint: docs/04-endpoints.md §0.11 L row 148.
  @ApiBearerAuth('JWT')
  @Put(':id/connect')
  async acceptConnect(
    @CurrentUser() user: { id: string; activeRole: string; clientSubtype: string | null },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.engagementsService.acceptConnect(id, user);
  }

  // PUT /engagements/:id/decline — expert declines connection request.
  // Blueprint: docs/04-endpoints.md §0.11 L row 149.
  @ApiBearerAuth('JWT')
  @Put(':id/decline')
  async decline(
    @CurrentUser() user: { id: string; activeRole: string; clientSubtype: string | null },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.engagementsService.decline(id, user);
  }
}
