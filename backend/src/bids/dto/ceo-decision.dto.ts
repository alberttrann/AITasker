import { IsEnum } from 'class-validator';

// Per docs/04 §0.11 L row 161 + docs/06 §C BID_CEO_STATUS.
enum CeoDecisionAction {
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
}

// PUT /bids/:id/ceo-decision body. Per docs/04 §0.11 L row 161.
export class CeoDecisionDto {
  @IsEnum(CeoDecisionAction)
  decision!: CeoDecisionAction;
}
