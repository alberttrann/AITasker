import { IsNotEmpty } from 'class-validator';

export class InitiateBankLinkDto {
  @IsNotEmpty()
  bank_account_xid: string;

  @IsNotEmpty()
  holder_name: string;
}
