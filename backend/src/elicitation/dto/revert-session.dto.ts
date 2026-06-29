import { IsInt, Min, Max } from 'class-validator';

export class RevertSessionDto {
  @IsInt()
  @Min(1)
  @Max(4)
  targetStage: number;
}