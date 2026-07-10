import { IsNotEmpty, IsString } from 'class-validator';

export class UpsertSeamClaimDto {
  @IsString()
  @IsNotEmpty()
  seamCode: string;
  // Seam code validated dynamically against DB in ExpertProfileService.
  // Valid codes come from seam_definitions table (e.g. A↔C, A↔D ...).
}