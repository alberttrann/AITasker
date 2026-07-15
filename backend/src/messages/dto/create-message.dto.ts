import { IsNotEmpty, IsString, IsOptional, IsUUID, IsUrl } from 'class-validator';

export class CreateMessageDto {
  @IsUUID('4', { message: 'Engagement ID must be a valid UUID v4.' })
  @IsOptional()
  engagement_id?: string;

  @IsUUID('4', { message: 'Project ID must be a valid UUID v4.' })
  @IsOptional()
  project_id?: string;

  @IsString({ message: 'Message content must be a valid string' })
  @IsNotEmpty({ message: 'Message content cannot be empty.' })
  content: string;

  @IsUrl({}, { message: 'Invalid URL, please try again.' })
  @IsOptional()
  attachment_url?: string;
}
