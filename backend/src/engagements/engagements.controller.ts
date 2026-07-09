import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EngagementsService } from './engagements.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';

@ApiTags('Engagements')
@Controller('engagements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENT', 'EXPERT', 'ADMIN')
export class EngagementsController {
  constructor(private readonly engagementsService: EngagementsService) {}

  // GET /engagements — list own engagements (ADMIN sees all).
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
  @ApiBearerAuth('JWT')
  @Get(':id')
  async findById(
    @CurrentUser() user: { id: string; activeRole: string; clientSubtype: string | null },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.engagementsService.findById(id, user);
  }

  // PUT /engagements/:id/nda — CEO accepts NDA.
  @ApiBearerAuth('JWT')
  @Put(':id/accept-nda')
  async acceptNda(
    @CurrentUser() user: { id: string; activeRole: string; clientSubtype: string | null },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.engagementsService.acceptNda(id, user);
  }

  // POST /engagements/:id/connect — expert accepts connection + NDA.
  @ApiBearerAuth('JWT')
  @Post(':id/connect')
  @HttpCode(200)
  async acceptConnect(
    @CurrentUser() user: { id: string; activeRole: string; clientSubtype: string | null },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.engagementsService.acceptConnect(id, user);
  }

  // PUT /engagements/:id/decline — expert declines connection request.
  @ApiBearerAuth('JWT')
  @Put(':id/decline')
  async decline(
    @CurrentUser() user: { id: string; activeRole: string; clientSubtype: string | null },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.engagementsService.decline(id, user);
  }
}
