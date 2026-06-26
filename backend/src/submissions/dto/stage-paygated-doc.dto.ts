import { IsNotEmpty, IsUrl, IsUUID } from "class-validator";



export class StagePaygatedDocDto {
    @IsUrl({}, { message: 'Invalid URL, please try again.' })
    @IsNotEmpty({ message: 'Document_url cannot be empty.'})
    document_url : string;

    @IsUUID('4', { message: 'milestone_id must be a valid UUID.' }) 
    @IsNotEmpty({ message: 'milestone_id cannot be empty.'})
    milestone_id : string;

}