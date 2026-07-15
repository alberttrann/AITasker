import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class UpsertDomainDepthDto {
  @IsString()
  @IsNotEmpty()
  domainCode: string;
  // Domain code validated dynamically against DB in ExpertProfileService

  @IsString()
  @IsNotEmpty()
  @IsEnum(['SURFACE', 'OPERATIONAL', 'DEEP'], {
    message: 'depthLevel must be SURFACE, OPERATIONAL, or DEEP',
  })
  depthLevel: string;
}
