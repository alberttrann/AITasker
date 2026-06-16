import { Injectable } from '@nestjs/common';
import { log } from 'node:console';
import * as crypto from 'node:crypto';

@Injectable()
export class HmacVerifierService {
  verify(rawBody: Buffer, signature: string, timestamp: string): boolean {
    const secret = process.env.SEPAY_WEBHOOK_SECRET;

    if (!secret) return false;

    // Checking timestamp for avoiding replay attack - 5 mins
    if (Math.abs(Date.now()) / 1000 - Number(timestamp) > 300) {
      return false;
    }

    // Create expected signature
    const expectedSignature =
      'sha256=' +
      crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${rawBody.toString('utf-8')}`)
        .digest('hex');

    // Safe comparing
    const sigBuffer = Buffer.from(signature);
    const expBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, expBuffer);
  }
}
