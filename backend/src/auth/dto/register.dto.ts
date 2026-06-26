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

  @IsOptional()
  taxCode?: string;

  @IsOptional()
  @IsBoolean()
  selfTechnical?: boolean;
}
