import { IsNotEmpty} from 'class-validator';
import { ArrayMinSize, IsArray, IsString, IsUrl } from 'class-validator';

export class StagePaygatedDocDto {
  @IsUrl({}, { message: 'Invalid URL, please try again.' })
  @IsNotEmpty({ message: 'document_url cannot be empty.' })
  document_url: string;
}

export class BulkStagePaygatedDocsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsUrl({}, { each: true, message: 'Every item must be a valid URL.' })
  documentUrls: string[];
}
