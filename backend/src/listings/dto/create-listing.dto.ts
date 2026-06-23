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
  serviceType?: ServiceType;

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

// POST /services body.
// Per docs/04 §0.11 K row 135: "Creates listing at state: DRAFT.
// For AI generator route: calls FastAPI /llm/service-generate before INSERT."
//
// Two paths in one DTO:
//   - Manual (useAiGenerator=false, default): title + priceVnd required.
//   - AI generator (useAiGenerator=true): capabilities + targetUseCases required;
//     title/priceVnd optional (filled from FastAPI response if absent).
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

  // --- Manual path fields ---
  @IsOptional()
  @ValidateIf((o: CreateListingDto) => !o.useAiGenerator)
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // priceVnd on the wire is a number (frontend uses JS numbers for VND up to 2^53).
  // We convert to BigInt before DB write. Manual path: required when !useAiGenerator.
  // AI path: optional (falls back to FastAPI suggestion).
  @IsOptional()
  @ValidateIf((o: CreateListingDto) => !o.useAiGenerator)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  priceVnd?: number;

  // --- AI generator path fields ---
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
