import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

// Enums mirror docs/06-enum-domains.md §A (Core Taxonomy Domains).
// Local to this DTO — duplicated in create-bid.dto.ts (intentional, allowed to diverge).

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

enum DomainDepth {
  SURFACE = 'SURFACE',
  OPERATIONAL = 'OPERATIONAL',
  DEEP = 'DEEP',
}

enum VerifyTier {
  CLAIMED = 'CLAIMED',
  EVIDENCE_BACKED = 'EVIDENCE_BACKED',
}

class DomainClaim {
  @IsEnum(DomainCode) code!: DomainCode;
  @IsEnum(DomainDepth) depth!: DomainDepth;
}

class SeamClaim {
  @IsEnum(SeamCode) code!: SeamCode;
  @IsEnum(VerifyTier) tier!: VerifyTier;
}

class FootprintAlignment {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DomainClaim)
  domains!: DomainClaim[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SeamClaim)
  seams!: SeamClaim[];
}

class ConditionalPrice {
  @IsInt()
  @IsPositive()
  milestone_number!: number;

  @IsInt()
  @IsPositive()
  price_vnd!: number;

  @IsString()
  @IsNotEmpty()
  condition!: string; // docs say `string | null`; treat null as empty string on the wire
}

// PUT /bids/:id body — the 3 bid components, no projectId (implicit in URL).
export class UpdateBidDto {
  @ValidateNested()
  @Type(() => FootprintAlignment)
  footprint_alignment_json!: FootprintAlignment;

  @IsString()
  @IsNotEmpty()
  approach_summary!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConditionalPrice)
  conditional_pricing_json!: ConditionalPrice[];
}
