import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true', // false for port 587 (STARTTLS)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    const subject = 'AITasker — Reset your password';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Reset your password</h2>
        <p>You requested a password reset for your AITasker account.</p>
        <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetLink}"
           style="display:inline-block; padding:12px 24px; background:#4F46E5;
                  color:#fff; text-decoration:none; border-radius:6px; margin:16px 0;">
          Reset Password
        </a>
        <p style="color:#666; font-size:14px;">
          Or copy this link into your browser:<br/>
          <a href="${resetLink}" style="color:#4F46E5;">${resetLink}</a>
        </p>
        <hr style="border:none; border-top:1px solid #eee; margin:24px 0;"/>
        <p style="color:#999; font-size:12px;">
          If you did not request this, you can safely ignore this email.
          Your password will not be changed.
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: process.env.FROM_EMAIL ?? '"AITasker" <noreply@aitasker.com>',
        to,
        subject,
        html,
      });
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (error) {
      // Log the error but do NOT throw — we don't want SMTP failures to
      // reveal whether the email exists (anti-enumeration).
      this.logger.error(`Failed to send password reset email to ${to}`, error);
    }
  }
}
