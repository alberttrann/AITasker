import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigReadService } from './config.service';

@ApiTags('Config')
@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigReadService) {}

  @Get('domains')
  @ApiOperation({ summary: 'List active domain definitions (no auth required)' })
  getDomains() {
    return this.configService.getDomains();
  }

  @Get('seams')
  @ApiOperation({ summary: 'List active seam definitions (no auth required)' })
  getSeams() {
    return this.configService.getSeams();
  }

  @Get('archetypes')
  @ApiOperation({ summary: 'List active archetype definitions (no auth required)' })
  getArchetypes() {
    return this.configService.getArchetypes();
  }

  @Get('archetypes/:code/probe-questions')
  @ApiOperation({ summary: 'List active probe questions for an archetype (no auth required)' })
  getProbeQuestions(@Param('code') code: string) {
    return this.configService.getProbeQuestions(code);
  }

  @Get('subscription-packages')
  @ApiOperation({
    summary: 'List active subscription packages with current price (no auth required)',
    description:
      'Used by the CEO and Expert subscription activation UI to display ' +
      'the current price dynamically. Pass ?role=CLIENT or ?role=EXPERT ' +
      'to get only the relevant package.',
  })
  getSubscriptionPackages(@Query('role') role?: string) {
    return this.configService.getSubscriptionPackages(role);
  }
}