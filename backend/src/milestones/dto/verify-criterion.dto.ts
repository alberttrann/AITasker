import { IsString, IsOptional, MaxLength } from 'class-validator';

export class VerifyCriterionDto {
  @IsString({ message: 'verification_comment must be a valid string.' }) 
  @MaxLength(500, { message: 'verification_comment cannot exceed 500 characters.' }) 
  @IsOptional() 
  verification_comment?: string;
}