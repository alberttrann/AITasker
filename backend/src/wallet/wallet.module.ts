import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { PrismaService } from 'prisma/prisma.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [WalletController],
  providers: [WalletService, PrismaService],

  imports: [AuthModule],
})
export class WalletModule {}
