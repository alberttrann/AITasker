import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class Stage4HandoffDto {
  @IsString()
  @IsNotEmpty()
  current_stack: string;

  @IsString()
  @IsNotEmpty()
  data_available: string;

  @IsString()
  @IsOptional()
  latency_requirement?: string;

  // Optional supplemental text from Tech Lead for Requirement 1
  @IsString()
  @IsOptional()
  additional_requirement_1?: string;
}
