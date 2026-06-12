import {
  IsEmail,
  IsNotEmpty,
  IsStrongPassword,
  IsString,
  MaxLength,
  IsOptional,
  MinLength,
} from 'class-validator';

export class RegisterUserDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsStrongPassword()
  password: string;

  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  fullName: string;

  @IsOptional()
  phone: string;

  roles: JsonWebKey
}
