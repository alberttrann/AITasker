import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

// Filter enums mirror docs/06-enum-domains.md §A (DOMAIN_CODE, SEAM_CODE)
// and §D (SERVICE_TYPE). Local to this DTO — duplicated intentionally,
// each route's DTO is allowed to diverge per project convention.

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

// GET /services query — all filters optional, AND'd together.
// Per docs/04 §0.11 K row 133: "Filterable by service_type,
// domains_json, seams_json, price range."
export class ListServicesFilterDto {
  @IsOptional()
  @IsEnum(ServiceType)
  service_type?: ServiceType;

  // Repeated query param: ?domains=A&domains=B
  // Array contains ALL of the requested values (Prisma array_contains semantics).
  // Filter is doc-silent on ANY vs ALL; we use ALL because it matches the
  // CEO "I need all these capabilities" mental model.
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
