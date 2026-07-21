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

// ServiceType is kept as enum — it's a fixed product type, not admin-configurable.
enum ServiceType {
  AI_SERVICE     = 'AI_SERVICE',
  TECH_DISCOVERY = 'TECH_DISCOVERY',
}

// Filter DTO for GET /services?domain=...&seam=...
// DomainCode and SeamCode are removed — any string is now valid.
export class ListServicesFilterDto {
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  // Domain filter — any active domain code e.g. "A", "B", "G"
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'each domain code must not be empty' })
  @Type(() => String)
  domains?: string[];

  // Seam filter — use ↔ arrow format e.g. "A↔C", "A↔D"
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true, message: 'each seam code must not be empty' })
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
  serviceType: ServiceType;

  // Domain codes the listing targets — any string validated against DB at service layer
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @Type(() => String)
  domainsJson?: string[];

  // Seam codes the listing covers — use ↔ arrow format
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
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