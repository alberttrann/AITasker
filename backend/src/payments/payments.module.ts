import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { IpnHandlerService } from './ipn-handler.service';
import { HmacVerifierService } from './hmac-verifier.service';
import { PrismaService } from 'prisma/prisma.service';
import { BankHubController } from './bank-hub.controller';
import { AuthService } from 'src/auth/auth.service';

@Module({
  controllers: [WebhooksController, BankHubController],
  providers: [IpnHandlerService, HmacVerifierService, PrismaService, AuthService],
})
export class PaymentsModule {}
