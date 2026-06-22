import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { WalletTopupAmmountDto } from './dto/wallet-topup.dto';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@Controller('wallets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENT', 'EXPERT')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @ApiBearerAuth('JWT') // Add this to make the bearer of Swagger work
  @Get('me')
  // @Req: taking request from client-side
  getWalletBalance(@Req() req: any) {
    return this.walletService.getWalletBalance(req.user.id);
  }

  @ApiBearerAuth('JWT')
  @Get('me/transactions')
  getWalletTransaction(@Req() req: any) {
    return this.walletService.getWalletTransaction(req.user.id);
  }

  @ApiBearerAuth('JWT')
  @Post('virtual-accounts/topup')
  getTopupWallet(@Req() req: any, @Body() walletDto: WalletTopupAmmountDto) {
    return this.walletService.getTopupWallet(req.user.id, walletDto);
  }
}
