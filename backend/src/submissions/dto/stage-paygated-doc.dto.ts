import { IsNotEmpty, IsUrl } from "class-validator";

export class StagePaygatedDocDto {
    @IsUrl({}, { message: 'Invalid URL, please try again.' })
    @IsNotEmpty({ message: 'document_url cannot be empty.'})
    document_url : string;
}