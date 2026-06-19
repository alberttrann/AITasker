import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { IpnHandlerService } from './ipn-handler.service';
import { HmacVerifierService } from './hmac-verifier.service';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  controllers: [WebhooksController],
  providers: [IpnHandlerService, HmacVerifierService, PrismaService],
})
export class PaymentsModule {}
