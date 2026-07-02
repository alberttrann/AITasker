import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Put, Controller, Param, Body, UseGuards, Post } from '@nestjs/common';
import { DodService } from './dod.service';
import { UpdateMilestoneDoDItemDto } from './dto/update-dod-item.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { CreateDodItemDto } from './dto/create-dod-item.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

@ApiTags('DoD Checklist')
@ApiBearerAuth('JWT')
@Controller('milestones/:id/dod')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MilestonesController {
  constructor(private readonly dodService: DodService) {}

  @Post('items')
  @Roles('EXPERT', 'CLIENT')
  @ApiOperation({ summary: 'Add a new item to the DoD checklist' })
  async createDodItem(@Param('id') milestoneId: string, @Body() dto: CreateDodItemDto) {
    return this.dodService.create(milestoneId, dto);
  }

  @Put(':itemId')
  @Roles('EXPERT')
  async updateDodStatus(
    @Param('itemId') itemId: string,
    @Param('id') milestoneId: string,
    @Body() dto: UpdateMilestoneDoDItemDto,
  ) {
    return this.dodService.updateDodStatus(itemId, milestoneId, dto);
  }
}
