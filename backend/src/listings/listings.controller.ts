import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
  Delete
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ListingsService } from './listings.service';
import { CreateListingDto, ListServicesFilterDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Listings')
@Controller('services')
@UseGuards(JwtAuthGuard, RolesGuard)
// GET /services is open to all authenticated users per docs/04 §0.11 K row 133.
// Other routes (POST/PUT/purchase) narrow roles at the method level.
@Roles('CLIENT', 'EXPERT', 'ADMIN')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @ApiBearerAuth('JWT')
  @Get('me')
  @Roles('EXPERT')
  @ApiOperation({ summary: "Expert's own listings (all states including DRAFT)" })
  async myListings(@CurrentUser() user: { id: string }) {
    return this.listingsService.myListings(user.id);
  }

  @ApiBearerAuth('JWT')
  @Get('me/purchases')
  @Roles('CLIENT')
  @ApiOperation({ summary: "CEO's purchased services" })
  async myPurchases(@CurrentUser() user: { id: string }) {
    return this.listingsService.myPurchases(user.id);
  }

  @ApiBearerAuth('JWT')
  @Get()
  // GET /services — browse marketplace (state = PUBLISHED only).
  // Blueprint: docs/04-endpoints.md §0.11 K row 133.
  async list(@Query() filter: ListServicesFilterDto) {
    return this.listingsService.list(filter);
  }

  @ApiBearerAuth('JWT')
  @Post()
  // POST /services — EXPERT creates a service listing at state: DRAFT.
  // Blueprint: docs/04-endpoints.md §0.11 K row 135.
  // Method-level @Roles('EXPERT') overrides the class-level gate.
  @Roles('EXPERT')
  async create(@CurrentUser() user: { id: string }, @Body() body: CreateListingDto) {
    return this.listingsService.create(user.id, body);
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

  @ApiBearerAuth('JWT')
  @Put(':id')
  // PUT /services/:id — owner updates draft listing or transitions DRAFT → PUBLISHED.
  // Blueprint: docs/04-endpoints.md §0.11 K row 136.
  // Guard (in service): not owner → 403 · SUSPENDED → 422 · serviceType after PUBLISHED → 422.
  @Roles('EXPERT')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateListingDto,
  ) {
    return this.listingsService.update(id, user.id, body);
  }

  @ApiBearerAuth('JWT')
  @Post(':id/purchase')
  // POST /services/:id/purchase — CEO purchases a published service.
  // Blueprint: docs/04-endpoints.md §0.11 K row 137.
  // Guard (in service): CEO role → 403 · !PUBLISHED → 422 · balance < price → 422.
  @Roles('CLIENT')
  async purchase(
    @CurrentUser() user: { id: string; activeRole: string; clientSubtype?: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listingsService.purchase(id, user);
  }

  @ApiBearerAuth('JWT')
  @Delete(':id')
  @Roles('EXPERT')
  @ApiOperation({ summary: 'Delete / archive a service listing (only DRAFT state)' })
  async delete(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listingsService.delete(id, user.id);
  }

  @ApiBearerAuth('JWT')
  @Put(':id/publish')
  @Roles('EXPERT')
  @ApiOperation({ summary: 'Publish a DRAFT listing to the marketplace' })
  async publish(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listingsService.setPublishState(id, user.id, 'PUBLISHED');
  }

  @ApiBearerAuth('JWT')
  @Put(':id/unpublish')
  @Roles('EXPERT')
  @ApiOperation({ summary: 'Pull a PUBLISHED listing back to DRAFT' })
  async unpublish(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.listingsService.setPublishState(id, user.id, 'DRAFT');
  }
}
