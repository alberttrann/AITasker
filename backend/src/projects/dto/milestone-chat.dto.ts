import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class MilestoneChatDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  // If provided, conversation history is loaded from DB and the reply is
  // appended to that session. If omitted, a new session is created.
  @IsUUID('4', { message: 'chatSessionId must be a valid UUID.' })
  @IsOptional()
  chatSessionId?: string;
}