import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import emailValidator from 'node-email-verifier';

@Injectable()
export class EmailValidatorService {
  private readonly logger = new Logger(EmailValidatorService.name);

  async assertValidEmail(email: string): Promise<void> {
    let result: { valid: boolean; reason?: string };

    try {
      result = await (emailValidator as any)(email, {
        checkMx: true, // DNS lookup — domain must have working mail servers
        checkDisposable: true, // Block Mailinator, TempMail, GuerrillaMail, etc.
        detailed: true, // Get specific failure reason
        timeout: '5s', // Prevent hanging the signup request
      });
    } catch (err) {
      // Transient DNS error — fail open so legitimate users aren't blocked
      // during network blips. Log it for observability.
      this.logger.warn(`Email MX check failed for domain, failing open: ${err}`);
      return;
    }

    if (!result.valid) {
      const reason = (result as any).reason ?? 'invalid';

      if (reason === 'mx') {
        throw new BadRequestException(
          'Email domain does not exist or cannot receive mail. Please use a valid email address.',
        );
      }
      if (reason === 'disposable') {
        throw new BadRequestException(
          'Temporary or throwaway email addresses are not permitted. Please use a permanent email.',
        );
      }
      throw new BadRequestException('Please enter a valid email address.');
    }
  }
}
