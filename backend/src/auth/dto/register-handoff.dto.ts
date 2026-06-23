// backend/src/auth/dto/register-handoff.dto.ts

/**
 * Used by a Tech Team member completing registration via the invite link
 * sent from POST /elicitation/sessions/:id/invite-tech-team.
 *
 * invite_token is the signed JWT containing { sessionId, ceoId, invitedEmail }.
 * AuthService.registerHandoff() verifies it with the same JwtService used for
 * login tokens, then creates the user with activeRole=CLIENT, clientSubtype=TECH_TEAM,
 * and links tech_team_profiles.linked_client_id = ceoId from the token.
 */
import { IsString, IsNotEmpty, IsStrongPassword, IsEmail } from 'class-validator';

export class RegisterHandoffDto {
  @IsString()
  @IsNotEmpty()
  invite_token: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsStrongPassword()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;
}