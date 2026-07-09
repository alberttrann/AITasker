import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class InviteExpertDto {
  @IsUUID('4', { message: 'projectId must be a valid UUID v4.' })
  @IsNotEmpty()
  projectId: string;

  @IsUUID('4', { message: 'expertId must be a valid UUID v4.' })
  @IsNotEmpty()
  expertId: string;

  @IsString()
  @IsOptional()
  content?: string;
}