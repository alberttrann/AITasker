import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ListingsService } from './listings.service';
import { ListServicesFilterDto } from './dto/create-listing.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('listings')
@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
// GET /services is open to all authenticated users per docs/04 §0.11 K row 133.
// Other routes (POST/PUT/purchase) will narrow roles at the method level.
@Roles('CLIENT', 'EXPERT', 'ADMIN')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @ApiBearerAuth('JWT')
  @Get()
  // GET /services — browse marketplace (state = PUBLISHED only).
  // Blueprint: docs/04-endpoints.md §0.11 K row 133.
  async list(@Query() filter: ListServicesFilterDto) {
    return this.listingsService.list(filter);
  }

  @ApiBearerAuth('JWT')
  @Get(':id')
  // GET /services/:id — single listing detail (with reputation aggregates).
  // Blueprint: docs/04-endpoints.md §0.11 K row 134.
  // Guard (in service): state != PUBLISHED AND not owner/admin → 404.
  async findOne(
    @CurrentUser() user: { id: string; activeRole: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listingsService.findOne(id, user);
  }
}
