import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class UpsertDomainDepthDto {
  @IsString()
  @IsNotEmpty()
  @IsEnum(['A', 'B', 'C', 'D', 'E', 'F'], {
    message: 'domainCode must be one of the 6 capability domains: A, B, C, D, E, F',
  })
  domainCode: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['SURFACE', 'OPERATIONAL', 'DEEP'], {
    message: 'depthLevel must be SURFACE, OPERATIONAL, or DEEP',
  })
  depthLevel: string;
}
