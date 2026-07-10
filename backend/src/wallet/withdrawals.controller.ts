import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WithdrawalsService } from './withdrawals.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Withdrawals')
@ApiBearerAuth()
@Controller('withdrawals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('EXPERT')
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Post()
  @ApiOperation({ summary: 'Request a cash-out to your linked bank account' })
  async requestWithdrawal(@CurrentUser() user: AuthUser, @Body() dto: CreateWithdrawalDto) {
    return this.withdrawalsService.requestWithdrawal(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'View your own withdrawal request history' })
  async getMyWithdrawals(@CurrentUser() user: AuthUser) {
    return this.withdrawalsService.getMyWithdrawals(user.id);
  }
}
