import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { IpnHandlerService } from './ipn-handler.service';
import { HmacVerifierService } from './hmac-verifier.service';

@Module({
  controllers: [WebhooksController],
  providers: [IpnHandlerService, HmacVerifierService],
})
export class PaymentsModule {}
