import { IsNotEmpty, IsString, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class CreateDodItemDto {
  @IsString({ message: 'item_description must be a valid string.' }) 
  @IsNotEmpty({ message: 'item_description cannot be empty.' }) 
  item_description: string;

  @IsBoolean({ message: 'is_required must be a boolean value.' }) 
  @IsOptional()
  is_required?: boolean;

  @IsUUID('4', { message: 'maps_to_criterion_id must be a valid UUID.' }) 
  @IsOptional() 
  maps_to_criterion_id?: string;
}