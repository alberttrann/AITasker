import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

enum ServiceState {
  DRAFT     = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}

enum ServiceType {
  AI_SERVICE     = 'AI_SERVICE',
  TECH_DISCOVERY = 'TECH_DISCOVERY',
}

export class UpdateListingDto {
  @IsOptional()
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

  // Domain codes — any string validated against DB at service layer
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  domainsJson?: string[];

  // Seam codes — use ↔ arrow format, validated at service layer
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  seamsJson?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priceVnd?: number;

  @IsOptional()
  @IsEnum(ServiceState)
  state?: ServiceState;

  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;
}