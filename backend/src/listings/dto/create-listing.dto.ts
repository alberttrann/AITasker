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

export class ListServicesFilterDto {
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  domains?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  seams?: string[];

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
  @IsString({ each: true })
  @Type(() => String)
  domainsJson?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  seamsJson?: string[];

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
