import {
  Body,
  Controller,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { HmacVerifierService } from './hmac-verifier.service';
import { IpnHandlerService } from './ipn-handler.service';

@Controller('webhooks/sepay')
export class WebhooksController {
  constructor(
    private readonly hmacService: HmacVerifierService,
    private readonly ipnHandlerService: IpnHandlerService,
  ) {}
  @Post('ipn')
  async handleIpn(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-sepay-signature') signature: string,
    @Headers('x-sepay-timestamp') timestamp: string,
  ) {
    const rawBody = req.rawBody;

    if (!rawBody || !this.hmacService.verify(rawBody, signature, timestamp)) {
      throw new UnauthorizedException('Invalid signature');
    }

    const data = req.body;
    return { success: true };
  }

  @Post('chi-ho-credit')
  async handleChiHo(@Body() body: any) {
    return { success: true };
  }

  @Post('bank-linked')
  async handleBankLinked(@Body() body: any) {
    return { success: true };
  }
}
