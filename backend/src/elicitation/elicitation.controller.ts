import { ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Post,
  Put,
  Get,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ElicitationService } from './elicitation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Stage1Dto } from './dto/stage1.dto';
import { Stage2Dto } from './dto/stage2.dto';
import { Stage3Dto } from './dto/stage3.dto';
import { Stage4Dto } from './dto/stage4.dto';
import { Stage4HandoffDto } from './dto/stage4-handoff.dto';
import { SetSelfTechnicalDto } from './dto/set-self-technical.dto';
import { RevertSessionDto } from './dto/revert-session.dto';
import { Delete } from '@nestjs/common';

interface AuthUser {
  id: string;
  activeRole: string;
  clientSubtype?: string | null;
}

@ApiTags('Elicitation')
@Controller('elicitation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ElicitationController {
  constructor(private readonly elicitationService: ElicitationService) {}

  // [None] — session creation is free; gating starts at Stage 1.
  @Post('sessions')
  @Roles('CLIENT')
  async createSession(@CurrentUser() user: AuthUser) {
    this.assertCeoOnly(user);
    return this.elicitationService.createSession(user.id);
  }

  // [Pro-C]
  @Get('sessions/:id')
  @UseGuards(SubscriptionGuard)
  @Roles('CLIENT')
  async getSession(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assertCeoOnly(user);
    return this.elicitationService.getSession(id, user.id);
  }

  // [Pro-C]
  @Put('sessions/:id/stage1')
  @UseGuards(SubscriptionGuard)
  @Roles('CLIENT')
  async processStage1(
    @Param('id') id: string,
    @Body() body: Stage1Dto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCeoOnly(user);
    return this.elicitationService.processStage1(id, body.symptomText, user.id);
  }

  // [Pro-C]
  @Put('sessions/:id/stage2')
  @UseGuards(SubscriptionGuard)
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

  // [Pro-C]
  @Put('sessions/:id/stage3')
  @UseGuards(SubscriptionGuard)
  @Roles('CLIENT')
  async processStage3(
    @Param('id') id: string,
    @Body() body: Stage3Dto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCeoOnly(user);
    return this.elicitationService.processStage3(id, body.probeResponses, user.id);
  }

  // [Pro-C]
  @Put('sessions/:id/stage4')
  @UseGuards(SubscriptionGuard)
  @Roles('CLIENT')
  async processStage4(
    @Param('id') id: string,
    @Body() body: Stage4Dto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCeoOnly(user);
    return this.elicitationService.processStage4(id, body, user.id);
  }

  // [None] — Tech Team doesn't have their own Pro-C subscription; they act
  // on the CEO's already-gated session.
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

  // [Pro-C]
  @Post('sessions/:id/generate-handoff-link')
  @UseGuards(SubscriptionGuard)
  @Roles('CLIENT')
  async inviteTechTeam(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assertCeoOnly(user);
    return this.elicitationService.inviteTechTeam(id, user.id);
  }

  // [Pro-C]
  @Put('sessions/:id/self-technical')
  @UseGuards(SubscriptionGuard)
  @Roles('CLIENT')
  async setSelfTechnical(
    @Param('id') id: string,
    @Body() body: SetSelfTechnicalDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCeoOnly(user);
    return this.elicitationService.setSelfTechnical(id, user.id, body.selfTechnical);
  }

  // [Pro-C]
  @Post('sessions/:id/retry-synthesis')
  @UseGuards(SubscriptionGuard)
  @Roles('CLIENT')
  async retryFailedSynthesis(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assertCeoOnly(user);
    return this.elicitationService.retryFailedSynthesis(id, user.id);
  }

  // [Pro-C]
  @Get('sessions')
  @UseGuards(SubscriptionGuard)
  @Roles('CLIENT')
  async getSessionsList(@CurrentUser() user: AuthUser) {
    this.assertCeoOnly(user);
    return this.elicitationService.getSessions(user.id);
  }

  // [Pro-C]
  @Put('sessions/:id/revert')
  @UseGuards(SubscriptionGuard)
  @Roles('CLIENT')
  async revertSession(
    @Param('id') id: string,
    @Body() dto: RevertSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    this.assertCeoOnly(user);
    return this.elicitationService.revertSession(id, user.id, dto.targetStage);
  }

  // [Pro-C]
  @Put('sessions/:id/abandon')
  @UseGuards(SubscriptionGuard)
  @Roles('CLIENT')
  async abandonSession(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assertCeoOnly(user);
    return this.elicitationService.abandonSession(id, user.id);
  }

  private assertCeoOnly(user: AuthUser) {
    if (user.clientSubtype !== 'CEO') {
      throw new ForbiddenException('Only the CEO may perform this action.');
    }
  }

  // [Pro-C]
  @Put('sessions/:id/continue')
  @UseGuards(SubscriptionGuard)
  @Roles('CLIENT')
  async continueSession(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assertCeoOnly(user);
    return this.elicitationService.continueSession(id, user.id);
  }

  // [Pro-C]
  @Post('sessions/:id/stage4-recommend')
  @UseGuards(SubscriptionGuard)
  @Roles('CLIENT')
  async recommendTechContext(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assertCeoOnly(user);
    return this.elicitationService.recommendTechContext(id, user.id);
  }

  // [Pro-C]
  @Delete('sessions/:id')
  @UseGuards(SubscriptionGuard)
  @Roles('CLIENT')
  async deleteSession(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    this.assertCeoOnly(user);
    return this.elicitationService.deleteSession(id, user.id);
  }
}
