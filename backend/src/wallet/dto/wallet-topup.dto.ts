import { IsInt, Min } from 'class-validator';

export class WalletTopupAmmountDto {
  @IsInt()
  @Min(2000)
  amount: number;
}
