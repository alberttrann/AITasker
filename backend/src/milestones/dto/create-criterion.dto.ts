import {
  IsString, IsNotEmpty, IsBoolean, IsOptional,
} from 'class-validator';

export class CreateCriterionDto {
  @IsString({ message: 'criterion_text must be a valid string.' })
  @IsNotEmpty({ message: 'criterion_text cannot be empty.' })
  criterion_text: string;

  @IsBoolean({ message: 'is_required must be a boolean value.' })
  @IsOptional()
  is_required?: boolean = true;
}