import { IsArray, IsString } from 'class-validator';

export class SyncSeamsDto {
  @IsArray()
  @IsString({ each: true })
  seams: string[];
}
