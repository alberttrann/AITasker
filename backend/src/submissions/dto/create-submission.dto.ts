import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from "class-validator";


export class CreateSubmissionDto {
    @IsUUID('4', { message: 'expert_id must be a valid UUID.' }) 
    @IsNotEmpty({ message: 'expert_id cannot be empty.'})
    expert_id : string;

    @IsNotEmpty({ message : 'Description cannot be empty.'})
    @IsString({ message: 'Description must be a String'})
    description : string;

    @IsArray({ message: 'files_json must be an array of file URLs.' })
    @IsString({ each: true, message: 'Each file URL must be a string.' })
    @IsOptional() 
    files_json?: string[];
}