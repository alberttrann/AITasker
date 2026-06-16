import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { ApiBearerAuth } from '@nestjs/swagger';

@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @ApiBearerAuth('JWT') // Add this to make the bearer of Swagger work
  @UseGuards(JwtAuthGuard)
  @Get('me')
  // @Req: taking request from client-side
  getWalletBalance(@Req() req: any) {
    return this.walletService.getWalletBalance(req.user.id);
  }
}
