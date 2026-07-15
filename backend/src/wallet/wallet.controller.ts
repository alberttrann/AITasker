import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { Body, Controller, Get, Post, Req, UseGuards, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { WalletTopupAmmountDto } from './dto/wallet-topup.dto';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';

@ApiTags('Wallet')
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
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  getWalletTransaction(
    @Req() req: any,
    @Query('type') type?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    return this.walletService.getWalletTransaction(req.user.id, { type, limit, offset });
  }

  @ApiBearerAuth('JWT')
  @Post('virtual-accounts/topup')
  getTopupWallet(@Req() req: any, @Body() walletDto: WalletTopupAmmountDto) {
    return this.walletService.getTopupWallet(req.user.id, walletDto);
  }
}
