import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class UpsertSeamClaimDto {
  @IsString()
  @IsNotEmpty()
  @IsEnum(['A↔C', 'A↔F', 'A↔D', 'D↔E', 'D↔F', 'C↔F', 'E↔F', 'A↔B', 'B↔E', 'C↔E'], {
    message: 'seamCode must be one of the 10 defined capability boundary seams',
  })
  seamCode: string;
}
