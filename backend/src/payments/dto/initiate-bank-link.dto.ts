import { IsNotEmpty, Matches, MaxLength, MinLength } from 'class-validator';

export class InitiateBankLinkDto {
  @IsNotEmpty()
  @Matches(/^[0-9]{6,19}$/, {
    message: 'bank_account_xid must be numeric and between 6 and 19 digits.',
  })
  bank_account_xid: string;

  @IsNotEmpty()
  @MinLength(2, { message: 'holder_name must be at least 2 characters.' })
  @MaxLength(100, { message: 'holder_name must be at most 100 characters.' })
  @Matches(/^[\p{L}\s.'-]+$/u, {
    message: 'holder_name may only contain letters, spaces, and . \' -',
  })
  holder_name: string;
}
