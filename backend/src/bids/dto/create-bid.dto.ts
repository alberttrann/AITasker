import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

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
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsEnum(DomainDepth) depth!: DomainDepth;
}

class SeamClaim {
  @IsString()
  @IsNotEmpty()
  code!: string;

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

// POST /bids body — 3 bid components + projectId.
// Per docs/04 §0.11 L row 157 + docs/06 §F JSONB schemas.
export class CreateBidDto {
  @IsUUID()
  projectId!: string;

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
