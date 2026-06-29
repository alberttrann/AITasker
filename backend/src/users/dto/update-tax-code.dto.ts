import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateTaxCodeDto {
  @IsNotEmpty()
  @IsString()
  taxCode: string;
}
