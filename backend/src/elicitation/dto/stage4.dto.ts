import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

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

  @IsString()
  @IsOptional()
  additional_requirement_1?: string;

  @IsObject()
  @IsOptional()
  technical_artifacts?: Record<string, string>; 
}