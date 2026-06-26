import { IsString, IsNotEmpty, IsStrongPassword, IsEmail } from 'class-validator';

export class RegisterHandoffDto {
  @IsString()
  @IsNotEmpty()
  invite_token: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsStrongPassword()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;
}