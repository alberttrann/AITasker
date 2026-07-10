import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Put, Controller, Param, Body, UseGuards, Post, Get, Delete } from '@nestjs/common';
import { DodService } from './dod.service';
import { UpdateMilestoneDoDItemDto } from './dto/update-dod-item.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { CreateDodItemDto } from './dto/create-dod-item.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

@ApiTags('DoD Checklist')
@ApiBearerAuth('JWT')
@Controller('milestones/:id/dod')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DodController {
  constructor(private readonly dodService: DodService) {}

  @Post('items')
  @Roles('EXPERT', 'CLIENT')
  @ApiOperation({ summary: 'Add a new item to the DoD checklist' })
  async createDodItem(@Param('id') milestoneId: string, @Body() dto: CreateDodItemDto) {
    return this.dodService.create(milestoneId, dto);
  }

  @Put(':itemId')
  @Roles('EXPERT')
  async updateDodStatus(@Param('itemId') itemId: string, @Body() dto: UpdateMilestoneDoDItemDto) {
    return this.dodService.updateDodStatus(itemId, dto);
  }

  @Get()
  @Roles('CLIENT', 'EXPERT', 'ADMIN')
  @ApiOperation({ summary: 'List DoD items for a milestone' })
  async listDodItems(@Param('id') milestoneId: string) {
    return this.dodService.list(milestoneId);
  }

  @Delete(':itemId')
  @Roles('EXPERT', 'CLIENT')
  @ApiOperation({ summary: 'Delete a DoD item (only if PENDING)' })
  async deleteDodItem(@Param('itemId') itemId: string) {
    return this.dodService.delete(itemId);
  }
}
