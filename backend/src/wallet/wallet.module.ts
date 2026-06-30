import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';
import { PrismaService } from 'prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [WalletController, WithdrawalsController],
  providers: [WalletService, WithdrawalsService, PrismaService],
  imports: [AuthModule],
})
export class WalletModule {}