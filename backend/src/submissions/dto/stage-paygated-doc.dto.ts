import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsUrl, IsUUID } from "class-validator";



export class StagePaygatedDocDto {
    @IsUrl({}, { message: 'Invalid URL, please try again.' })
    @IsNotEmpty({ message: 'Document_url cannot be empty.'})
    document_url : string;

    @ApiProperty({ example: '35dda2ad-e1ec-4cb3-bf0c-5eea66a3cde7', description: 'ID of the milestone' })
    @IsUUID('4', { message: 'milestone_id must be a valid UUID.' }) 
    @IsNotEmpty({ message: 'milestone_id cannot be empty.'})
    milestone_id : string;

}