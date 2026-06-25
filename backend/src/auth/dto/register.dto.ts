// backend/src/auth/dto/register.dto.ts
// RECONCILED: merges Chi Nhan's taxCode (VietQR business verification)
// with our selfTechnical (A3b) — independent, non-conflicting additions.
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

  // Chi Nhan's — VietQR business-tax lookup, auto-fills companyName if valid.
  @IsOptional()
  taxCode?: string;

  // Ours (A3b) — registration-time self-technical default, CLIENT_CEO only.
  @IsOptional()
  @IsBoolean()
  selfTechnical?: boolean;
}