import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { Roles }        from '../../common/decorators/roles.decorator';
import { AdminConfigService } from './admin-config.service';
import {
  IsString, IsOptional, IsInt, IsBoolean, Min, IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

// Inline DTOs 

class CreateDefinitionDto {
  @IsString() @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsOptional() description?: string;
  @IsInt() @IsOptional() @Type(() => Number) sortOrder?: number;
}

class UpdateDefinitionDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() description?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsInt() @IsOptional() @Type(() => Number) sortOrder?: number;
}

class CreateProbeQuestionDto {
  @IsString() @IsNotEmpty() archetypeCode: string;
  @IsString() @IsNotEmpty() questionText: string;
  @IsInt() @Min(0) @IsOptional() @Type(() => Number) displayOrder?: number;
}

class UpdateProbeQuestionDto {
  @IsString() @IsOptional() questionText?: string;
  @IsInt() @Min(0) @IsOptional() @Type(() => Number) displayOrder?: number;
  @IsBoolean() @IsOptional() isActive?: boolean;
}

// Controller 

@ApiTags('Admin Config')
@ApiBearerAuth('JWT')
@Controller('admin/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminConfigController {
  constructor(private readonly svc: AdminConfigService) {}

  // Domains
  @Get('domains')  @ApiOperation({ summary: 'List all domain definitions' })
  listDomains() { return this.svc.listDomains(); }

  @Post('domains') @ApiOperation({ summary: 'Create a domain definition' })
  createDomain(@Body() dto: CreateDefinitionDto) { return this.svc.createDomain(dto); }

  @Put('domains/:id') @ApiOperation({ summary: 'Update a domain definition' })
  updateDomain(@Param('id') id: string, @Body() dto: UpdateDefinitionDto) { return this.svc.updateDomain(id, dto); }

  @Delete('domains/:id') @ApiOperation({ summary: 'Soft-delete a domain definition' })
  deleteDomain(@Param('id') id: string) { return this.svc.deleteDomain(id); }

  // Seams
  @Get('seams')  listSeams()  { return this.svc.listSeams(); }
  @Post('seams') createSeam(@Body() dto: CreateDefinitionDto) { return this.svc.createSeam(dto); }
  @Put('seams/:id') updateSeam(@Param('id') id: string, @Body() dto: UpdateDefinitionDto) { return this.svc.updateSeam(id, dto); }
  @Delete('seams/:id') deleteSeam(@Param('id') id: string) { return this.svc.deleteSeam(id); }

  // Archetypes
  @Get('archetypes')  listArchetypes()  { return this.svc.listArchetypes(); }
  @Post('archetypes') createArchetype(@Body() dto: CreateDefinitionDto) { return this.svc.createArchetype(dto); }
  @Put('archetypes/:id') updateArchetype(@Param('id') id: string, @Body() dto: UpdateDefinitionDto) { return this.svc.updateArchetype(id, dto); }
  @Delete('archetypes/:id') deleteArchetype(@Param('id') id: string) { return this.svc.deleteArchetype(id); }

  // Probe questions
  @Get('probe-questions')
  listProbeQuestions(@Query('archetypeCode') archetypeCode?: string) {
    return this.svc.listProbeQuestions(archetypeCode);
  }

  @Post('probe-questions')
  createProbeQuestion(@Body() dto: CreateProbeQuestionDto) { return this.svc.createProbeQuestion(dto); }

  @Put('probe-questions/:id')
  updateProbeQuestion(@Param('id') id: string, @Body() dto: UpdateProbeQuestionDto) {
    return this.svc.updateProbeQuestion(id, dto);
  }

  @Delete('probe-questions/:id')
  deleteProbeQuestion(@Param('id') id: string) { return this.svc.deleteProbeQuestion(id); }

  // Void Codes
  @Get('void-codes')
  listVoidCodes() { return this.svc.listVoidCodes(); }

  @Post('void-codes')
  createVoidCode(@Body() dto: {
    code: string; name: string; description: string;
    severity?: string; sortOrder?: number;
  }) { return this.svc.createVoidCode(dto); }

  @Put('void-codes/:id')
  updateVoidCode(@Param('id') id: string, @Body() dto: UpdateDefinitionDto & { severity?: string }) {
    return this.svc.updateVoidCode(id, dto);
  }

  @Delete('void-codes/:id')
  deleteVoidCode(@Param('id') id: string) { return this.svc.deleteVoidCode(id); }
}