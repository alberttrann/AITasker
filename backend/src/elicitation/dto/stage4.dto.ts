import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class Stage4Dto {
  @IsString()
  @IsNotEmpty()
  current_stack: string;

  @IsString()
  @IsNotEmpty()
  data_available: string;

  @IsString()
  @IsOptional()
  latency_requirement?: string;

  // Optional supplemental text the Expert/CEO can add to Requirement 1
  @IsString()
  @IsOptional()
  additional_requirement_1?: string;
}