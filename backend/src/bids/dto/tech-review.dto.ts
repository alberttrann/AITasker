import { IsEnum, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

// Per docs/04 §0.11 L row 160 + docs/06 §C BID_TECH_STATUS.
enum TechReviewAction {
  APPROVED = 'APPROVED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
}

// PUT /bids/:id/tech-review body.
// Per docs/04 §0.11 L row 160: tech_feedback required iff action=REVISION_REQUESTED.
export class TechReviewDto {
  @IsEnum(TechReviewAction)
  action!: TechReviewAction;

  // Required only when action=REVISION_REQUESTED.
  @IsOptional()
  @ValidateIf((o: TechReviewDto) => o.action === TechReviewAction.REVISION_REQUESTED)
  @IsString()
  @MinLength(1)
  tech_feedback?: string;
}
