import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpsertDomainDepthDto } from './upsert-domain-depth.dto';

export class SyncDomainsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertDomainDepthDto)
  domains: UpsertDomainDepthDto[];
}