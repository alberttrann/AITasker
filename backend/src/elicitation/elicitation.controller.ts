import { Controller, Post, Put, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ElicitationService } from './elicitation.service';

@Controller('elicitation')
export class ElicitationController {
  constructor(private readonly elicitationService: ElicitationService) {}

  @Post('sessions')
  // @UseGuards(AuthGuard) later
  // @Roles(ActiveRole.CLIENT)
  async createSession(@Request() req: any) {
    const userId = req.user.id; // Assuming user ID is available in the request object
    return this.elicitationService.createSession(userId);
  }

  @Put('sessions/:id/stage1')
  // @UseGuards(AuthGuard) later
  // @Roles(ActiveRole.CLIENT)
  async processStage1(@Param('id') id: string, @Body() body: { symptomText: string }) {
    return this.elicitationService.processStage1(id, body.symptomText);
  }
}
