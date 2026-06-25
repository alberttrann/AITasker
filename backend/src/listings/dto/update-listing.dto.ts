import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

// Enums mirror docs/06-enum-domains.md. Local to this DTO — duplicated
// intentionally; each route's DTO can diverge per project convention.

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

// Only allowed state transition via this endpoint: DRAFT → PUBLISHED.
// SUSPENDED/ARCHIVED are admin-only transitions.
enum ServiceState {
  PUBLISHED = 'PUBLISHED',
}

enum ServiceType {
  AI_SERVICE = 'AI_SERVICE',
  TECH_DISCOVERY = 'TECH_DISCOVERY',
}

// PUT /services/:id body — all fields optional, partial update.
// Per docs/04 §0.11 K row 136:
//   - Actor: EXPERT (owner).
//   - Guard: not owner → 403 · state = SUSPENDED → 422.
//   - Transition: DRAFT → PUBLISHED only. service_type immutable after PUBLISHED.
export class UpdateListingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

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
