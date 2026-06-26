import { IsBoolean, IsNotEmpty } from 'class-validator';

export class SetSelfTechnicalDto {
  @IsBoolean()
  @IsNotEmpty()
  selfTechnical: boolean;
}