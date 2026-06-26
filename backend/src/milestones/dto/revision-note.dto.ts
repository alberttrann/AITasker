import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { StringValidation } from 'zod';


export class RevisionNoteDto {
  @IsString({ message: 'revision_note must be a valid string.' }) 
  @IsNotEmpty({ message: 'revision_note cannot be empty.' })       
  @MinLength(10, { message: 'revision_note must be at least 10 characters long to be constructive.' })
  revision_note: string;
}