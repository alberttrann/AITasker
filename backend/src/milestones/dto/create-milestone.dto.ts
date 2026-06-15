import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsNumber, IsEnum, IsUUID, IsBoolean, IsArray, ValidateNested} from 'class-validator';

export class CreateCriteriationDto {
    @IsString()
    @IsNotEmpty()
    criterion_text : string;

    @IsNotEmpty()
    @IsBoolean()
    is_required : boolean;    
}

export class CreateMilestoneDto {
    @IsUUID()
    @IsNotEmpty()
    engagement_id: string;

    @IsString()
    @IsNotEmpty()
    deliverable_statement: string;

    @IsEnum(['TECH_TEAM', 'CEO', 'JOINT'])    
    @IsNotEmpty()
    sign_off_authority: 'TECH_TEAM'| 'CEO'| 'JOINT';

    @IsNumber()
    @IsNotEmpty()
    payment_amount_vnd: number;
    
    @IsArray()
    @ValidateNested({ each: true })
    @Type (() => CreateCriteriationDto)
    criteria: CreateCriteriationDto[];
}

