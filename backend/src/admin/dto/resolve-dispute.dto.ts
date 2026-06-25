import { IsEnum, IsOptional, IsNumber, Min, Max, ValidateIf } from 'class-validator';

export enum AdminDisputeDecision {
  EXPERT_WINS = 'EXPERT_WINS',
  CLIENT_WINS = 'CLIENT_WINS',
  SPLIT = 'SPLIT',
}

export class ResolveDisputeDto {
  @IsEnum(AdminDisputeDecision)
  decision: AdminDisputeDecision;

  // Required only when decision === SPLIT — the one outcome the AI path
  // can never produce on its own (its finding is strictly binary).
  @ValidateIf((o: ResolveDisputeDto) => o.decision === AdminDisputeDecision.SPLIT)
  @IsNumber()
  @Min(0)
  @Max(100)
  expertSharePercent?: number;
}