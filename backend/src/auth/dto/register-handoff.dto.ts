import { IsString, IsNotEmpty, IsEmail, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import {
  HasUppercase,
  HasLowercase,
  HasNumber,
  HasSpecialChar,
} from '../../common/validators/custom-password.validator';

export class RegisterHandoffDto {
  @IsString()
  @IsNotEmpty()
  invite_token: string;

  @IsNotEmpty({ message: 'Email is required.' })
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @Transform(({ value }) => (value as string).toLowerCase().trim())
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @HasUppercase({ message: 'Password must contain at least one uppercase letter.' })
  @HasLowercase({ message: 'Password must contain at least one lowercase letter.' })
  @HasNumber({ message: 'Password must contain at least one number.' })
  @HasSpecialChar({
    message: 'Password must contain at least one special character (!@#$%^&* ...).',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;
}
