import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import emailValidator, { type ValidationResult } from 'node-email-verifier';

const TRANSIENT_DNS_ERROR_CODES = new Set([
  'DNS_LOOKUP_FAILED',
  'DNS_LOOKUP_TIMEOUT',
  'MX_LOOKUP_FAILED',
]);

@Injectable()
export class EmailValidatorService {
  private readonly logger = new Logger(EmailValidatorService.name);

  async assertValidEmail(email: string): Promise<void> {
    let result: ValidationResult;

    try {
      result = (await emailValidator(email, {
        checkMx: true, // DNS lookup — domain must have working mail servers
        checkDisposable: true, // Block Mailinator, TempMail, GuerrillaMail, etc.
        detailed: true, // Get specific failure reason
        timeout: '5s', // Prevent hanging the signup request
      })) as ValidationResult;
    } catch (err) {
      // Transient DNS error — fail open so legitimate users aren't blocked
      // during network blips. Log it for observability.
      const errorCode = (err as { code?: string })?.code;
      this.logger.warn(
        `Email validation lookup failed${errorCode ? ` (${errorCode})` : ''}, failing open: ${err}`,
      );
      return;
    }

    if (!result.valid) {
      const errorCode =
        result.errorCode ??
        result.format.errorCode ??
        result.disposable?.errorCode ??
        result.mx?.errorCode;

      if (TRANSIENT_DNS_ERROR_CODES.has(errorCode ?? '')) {
        this.logger.warn(
          `Email validation lookup failed${errorCode ? ` (${errorCode})` : ''}, failing open.`,
        );
        return;
      }

      if (errorCode === 'NO_MX_RECORDS') {
        throw new BadRequestException(
          'Email domain does not exist or cannot receive mail. Please use a valid email address.',
        );
      }
      if (errorCode === 'DISPOSABLE_EMAIL') {
        throw new BadRequestException(
          'Temporary or throwaway email addresses are not permitted. Please use a permanent email.',
        );
      }
      throw new BadRequestException('Please enter a valid email address.');
    }
  }
}
