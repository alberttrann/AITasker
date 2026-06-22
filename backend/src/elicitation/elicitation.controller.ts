// backend/src/elicitation/elicitation.controller.ts
import {
  Controller, Post, Put, Get,
  Param, Body, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { ElicitationService }    from './elicitation.service';
import { JwtAuthGuard }          from '../common/guards/jwt-auth.guard';
import { RolesGuard }            from '../common/guards/roles.guard';
import { Roles }                 from '../common/decorators/roles.decorator';
import { CurrentUser }           from '../common/decorators/current-user.decorator';
import { Stage1Dto }             from './dto/stage1.dto';
import { Stage2Dto }             from './dto/stage2.dto';
import { Stage3Dto }             from './dto/stage3.dto';
import { Stage4Dto }             from './dto/stage4.dto';
import { Stage4HandoffDto }      from './dto/stage4-handoff.dto';
import { InviteTechTeamDto }     from './dto/invite-tech-team.dto';

interface AuthUser {
  id:             string;
  activeRole:     string;
  clientSubtype?: string | null;
}

@Controller('elicitation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ElicitationController {
  constructor(private readonly elicitationService: ElicitationService) {}

  // ── Session management — CEO ONLY ───────────────────────────────────────────

  @Post('sessions')
  @Roles('CLIENT')
  async createSession(@CurrentUser() user: AuthUser) {
    this.assertCeoOnly(user);
    return this.elicitationService.createSession(user.id);
  }

  @Get('sessions/:id')
  @Roles('CLIENT')
  async getSession(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCeoOnly(user);
    return this.elicitationService.getSession(id, user.id);
  }

  @Put('sessions/:id/stage1')
  @Roles('CLIENT')
  async processStage1(
    @Param('id') id: string,
    @Body() body: Stage1Dto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCeoOnly(user);
    return this.elicitationService.processStage1(id, body.symptomText, user.id);
  }

  @Put('sessions/:id/stage2')
  @Roles('CLIENT')
  async processStage2(
    @Param('id') id: string,
    @Body() body: Stage2Dto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCeoOnly(user);
    return this.elicitationService.processStage2(
      id,
      body.archetype,
      user.id,
      body.acknowledgedVoidCodes,
    );
  }

  @Put('sessions/:id/stage3')
  @Roles('CLIENT')
  async processStage3(
    @Param('id') id: string,
    @Body() body: Stage3Dto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCeoOnly(user);
    return this.elicitationService.processStage3(id, body.probeResponses, user.id);
  }

  @Put('sessions/:id/stage4')
  @Roles('CLIENT')
  async processStage4(
    @Param('id') id: string,
    @Body() body: Stage4Dto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCeoOnly(user);
    return this.elicitationService.processStage4(id, body, user.id);
  }

  // ── Stage 4 Handoff — TECH_TEAM ONLY ────────────────────────────────────────
  @Put('sessions/:id/stage4-handoff')
  @Roles('CLIENT')
  async processStage4Handoff(
    @Param('id') id: string,
    @Body() body: Stage4HandoffDto,
    @CurrentUser() user: AuthUser,
  ) {
    if (user.clientSubtype !== 'TECH_TEAM') {
      throw new ForbiddenException(
        'Only a Tech Team member may submit Stage 4 via the handoff route.',
      );
    }
    return this.elicitationService.processStage4Handoff(id, body, user.id);
  }

  // ── Invite Tech Team — CEO ONLY ─────────────────────────────────────────────
  // Generates a signed handoff link. No email is sent — the CEO copies and
  // shares it manually (no email-sending infrastructure exists in this codebase).
  @Post('sessions/:id/invite-tech-team')
  @Roles('CLIENT')
  async inviteTechTeam(
    @Param('id') id: string,
    @Body() body: InviteTechTeamDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCeoOnly(user);
    return this.elicitationService.inviteTechTeam(id, body.email, user.id);
  }

  // ── Confirm — CEO ONLY, triggers Stage 5 synthesis ──────────────────────────
  @Post('sessions/:id/confirm')
  @Roles('CLIENT')
  async confirmSession(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCeoOnly(user);
    return this.elicitationService.confirmSession(id, user.id);
  }

  // ── Private helper ───────────────────────────────────────────────────────────
  private assertCeoOnly(user: AuthUser) {
    if (user.clientSubtype !== 'CEO') {
      throw new ForbiddenException('Only the CEO may perform this action.');
    }
  }
}