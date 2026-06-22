import { IsEmail, IsNotEmpty } from 'class-validator';

export class InviteTechTeamDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}