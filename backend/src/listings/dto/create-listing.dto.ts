import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';


enum ServiceType {
  AI_SERVICE = 'AI_SERVICE',
  TECH_DISCOVERY = 'TECH_DISCOVERY',
}

enum DomainCode {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E',
  F = 'F',
}

enum SeamCode {
  A_C = 'A<->C',
  A_F = 'A<->F',
  A_D = 'A<->D',
  D_E = 'D<->E',
  D_F = 'D<->F',
  C_F = 'C<->F',
  E_F = 'E<->F',
  A_B = 'A<->B',
  B_E = 'B<->E',
  C_E = 'C<->E',
}

export class ListServicesFilterDto {
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @IsOptional()
  @IsArray()
  @IsEnum(DomainCode, { each: true })
  @Type(() => String)
  domains?: DomainCode[];

  @IsOptional()
  @IsArray()
  @IsEnum(SeamCode, { each: true })
  @Type(() => String)
  seams?: SeamCode[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPriceVnd?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPriceVnd?: number;
}

export class CreateListingDto {
  @IsEnum(ServiceType)
  serviceType!: ServiceType;

  @IsOptional()
  @IsArray()
  @IsEnum(DomainCode, { each: true })
  @Type(() => String)
  domainsJson?: DomainCode[];

  @IsOptional()
  @IsArray()
  @IsEnum(SeamCode, { each: true })
  @Type(() => String)
  seamsJson?: SeamCode[];

  @IsOptional()
  @IsBoolean()
  useAiGenerator?: boolean;

  @IsOptional()
  @ValidateIf((o: CreateListingDto) => !o.useAiGenerator)
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  timeline?: string;

  @IsOptional()
  @ValidateIf((o: CreateListingDto) => !o.useAiGenerator)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priceVnd?: number;

  @IsOptional()
  @ValidateIf((o: CreateListingDto) => !!o.useAiGenerator)
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  capabilities?: string[];

  @IsOptional()
  @ValidateIf((o: CreateListingDto) => !!o.useAiGenerator)
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  targetUseCases?: string[];
}
