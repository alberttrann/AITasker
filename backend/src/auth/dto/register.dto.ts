import { UserRoleItem } from '@common/enums/user-role-item.enum';
import {
  IsEmail,
  IsNotEmpty,
  IsStrongPassword,
  IsString,
  MaxLength,
  IsOptional,
  MinLength,
  IsEnum,
  IsBoolean,
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

  @IsNotEmpty()
  @IsEnum(UserRoleItem)
  roles: UserRoleItem;

  // registration-time default. Only meaningful for CLIENT_CEO registrations (the "do you have a dedicated tech team?" question designed into CeoRegister.tsx)
  // Ignored for EXPERTregistrations. Defaults to false (assumes "I need a tech team" / Scenario A) if omitted.
  @IsOptional()
  @IsBoolean()
  selfTechnical?: boolean;
}