import { IsInt, Min } from 'class-validator';

export class CreateWithdrawalDto {
  @IsInt()
  @Min(2000)
  amount: number;
}