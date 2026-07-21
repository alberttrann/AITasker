import { IsEnum } from 'class-validator';

export enum AdminDisputeDecision {
  EXPERT_WINS = 'EXPERT_WINS',
  CLIENT_WINS = 'CLIENT_WINS',
  SPLIT = 'SPLIT',
}

export class ResolveDisputeDto {
  @IsEnum(AdminDisputeDecision)
  decision: AdminDisputeDecision;
}
