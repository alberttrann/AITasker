import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { IpnHandlerService } from './ipn-handler.service';
import { HmacVerifierService } from './hmac-verifier.service';
import { PrismaService } from 'prisma/prisma.service';
import { BankHubController } from './bank-hub.controller';
import { AuthModule } from '../auth/auth.module'; 

@Module({
  imports: [AuthModule],
  controllers: [WebhooksController, BankHubController],
  providers: [IpnHandlerService, HmacVerifierService, PrismaService],
})
export class PaymentsModule {}