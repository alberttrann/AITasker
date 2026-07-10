import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDisputeDto {
  @IsUUID('4', { message: 'criterion_id must be a valid UUID.' })
  @IsNotEmpty({ message: 'criterion_id cannot be empty.' })
  criterion_id: string;

  @IsOptional()
  @IsString()
  additional_context?: string;
}
