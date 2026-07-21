import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyOtpDto {
  @IsNotEmpty({ message: 'Email is required.' })
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @Transform(({ value }) => (value as string).toLowerCase().trim())
  email: string;

  @IsNotEmpty({ message: 'OTP is required.' })
  @IsString()
  @Length(6, 6, { message: 'Verification code must be exactly 6 digits.' })
  otp: string;
}