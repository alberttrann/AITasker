import { IsNotEmpty, IsString, IsUUID, MinLength } from 'class-validator';

export class CreatePortfolioSubmissionDto {
  @IsUUID('4', { message: 'seamClaimId must be a valid UUID' })
  @IsNotEmpty()
  seamClaimId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(50, {
    message: 'projectDescription must be at least 50 characters for meaningful LLM evaluation',
  })
  projectDescription: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(20, {
    message: 'decisionPoints must be at least 20 characters for meaningful LLM evaluation',
  })
  decisionPoints: string; // see ai-service/app/prompts/portfolio_eval.txt
}
