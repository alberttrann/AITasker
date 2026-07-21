import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateCriterionDto } from './create-milestone.dto';

export class InitializeMilestoneItemDto {
  @IsInt()
  @Min(1)
  milestoneNumber: number;

  @IsString()
  @IsNotEmpty()
  deliverableStatement: string;

  @IsInt()
  @IsPositive()
  @Type(() => Number)
  paymentAmountVnd: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCriterionDto)
  criteria: CreateCriterionDto[];
}

export class BulkInitializeMilestonesDto {
  @IsUUID()
  engagementId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InitializeMilestoneItemDto)
  milestones: InitializeMilestoneItemDto[];
}
