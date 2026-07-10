import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminPromptsService } from './admin-prompts.service';
import { IsOptional, IsString } from 'class-validator';

class UpsertPromptDto {
  @IsString() templateText: string;
  @IsString() @IsOptional() description?: string;
}

@ApiTags('Admin Prompts')
@ApiBearerAuth('JWT')
@Controller('admin/prompts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminPromptsController {
  constructor(private readonly svc: AdminPromptsService) {}

  @Get()
  @ApiOperation({ summary: 'List all DB-stored prompt templates' })
  listPrompts() { return this.svc.listPrompts(); }

  @Get(':stage')
  @ApiOperation({ summary: 'Get full template text for a stage' })
  getPrompt(@Param('stage') stage: string) { return this.svc.getPrompt(stage); }

  @Put(':stage')
  @ApiOperation({
    summary: 'Create or update a prompt template',
    description: 'Use Jinja2 `{{ variable }}` syntax for dynamic values. '
      + 'Changes take effect within 60 seconds (FastAPI cache TTL).',
  })
  upsertPrompt(@Param('stage') stage: string, @Body() dto: UpsertPromptDto) {
    return this.svc.upsertPrompt(stage, dto);
  }

  @Delete(':stage')
  @ApiOperation({ summary: 'Reset stage to default .txt file (removes DB override)' })
  resetToDefault(@Param('stage') stage: string) { return this.svc.resetToDefault(stage); }
}