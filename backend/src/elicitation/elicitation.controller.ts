import {
  Controller,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ElicitationService } from './elicitation.service';
import { JwtAuthGuard }       from '../common/guards/jwt-auth.guard';
import { RolesGuard }         from '../common/guards/roles.guard';
import { Roles }              from '../common/decorators/roles.decorator';
import { CurrentUser }        from '../common/decorators/current-user.decorator';
import { Stage1Dto }          from './dto/stage1.dto';
import { Stage2Dto }          from './dto/stage2.dto';

// Elicitation controller
// All routes require an authenticated CLIENT (CEO or TECH_TEAM role).
//
// Blueprint guard order:
//   1. JwtAuthGuard   — validates token, populates req.user
//   2. RolesGuard     — checks activeRole === 'CLIENT'
//   3. SubscriptionGuard — TODO: add once subscriptions are wired;
//      elicitation requires Client Pro (subscription_client_tier = 'pro')
@Controller('elicitation')
@UseGuards(JwtAuthGuard, RolesGuard)    // applied to every route in this controller
@Roles('CLIENT')
export class ElicitationController {
  constructor(private readonly elicitationService: ElicitationService) {}

  // POST /elicitation/sessions
  // Blueprint: CREATE elicitation session for authenticated CEO.
  // FIX (blocking): was reading req.user.id with auth guard commented out →
  // TypeError at runtime. Now uses @CurrentUser() decorator which reads from
  // the request object populated by JwtAuthGuard.
  @Post('sessions')
  async createSession(@CurrentUser() user: { id: string }) {
    return this.elicitationService.createSession(user.id);
  }

  // PUT /elicitation/sessions/:id/stage1
  // Note for frontend team: this endpoint uses PUT (not POST).
  // Update your api-client calls accordingly.
  // TODO: align HTTP verb with frontend expectations in next PR (PUT vs POST).
  @Put('sessions/:id/stage1')
  async processStage1(
    @Param('id') id: string,
    @Body() body: Stage1Dto,
  ) {
    return this.elicitationService.processStage1(id, body.symptomText);
  }

  // PUT /elicitation/sessions/:id/stage2
  @Put('sessions/:id/stage2')
  async processStage2(
    @Param('id') id: string,
    @Body() body: Stage2Dto,
  ) {
    return this.elicitationService.processStage2(
      id,
      body.archetype,
      body.acknowledgedVoidCodes,
    );
  }
}