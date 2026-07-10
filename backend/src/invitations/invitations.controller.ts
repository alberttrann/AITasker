import { Controller, Get, Post, Param, UseGuards, Delete } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../common/guards/roles.guard';
import { Roles }        from '../common/decorators/roles.decorator';
import { CurrentUser }  from '../common/decorators/current-user.decorator';
import { AuthUser }     from '../auth/strategies/jwt.strategy';
import { InvitationsService } from './invitations.service';

@ApiTags('Invitations')
@ApiBearerAuth('JWT')
@Controller('invitations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  /**
   * GET /invitations
   * Expert: see all projects they've been invited to with full project metadata.
   * This is the "Invited Projects" page the FE team needs.
   */
  @Get()
  @Roles('EXPERT')
  @ApiOperation({
    summary: 'Get all project invitations for the logged-in expert',
    description:
      'Returns every invitation (PENDING, ACCEPTED, DECLINED) with full project ' +
      'metadata so the expert can see who invited them and details about the project. ' +
      'isExpired is computed at query time — no background job needed.',
  })
  getMyInvitations(@CurrentUser() user: AuthUser) {
    return this.invitationsService.getExpertInvitations(user.id);
  }

  /**
   * POST /invitations/:id/decline
   * Expert explicitly declines an invitation.
   */
  @Post(':id/decline')
  @Roles('EXPERT')
  @ApiOperation({ summary: 'Decline a project invitation' })
  declineInvitation(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.invitationsService.declineInvitation(id, user.id);
  }

  @Get('sent')
  @Roles('CLIENT')
  @ApiOperation({ summary: 'List invitations the CEO has sent (across all projects)' })
  getSentInvitations(@CurrentUser() user: AuthUser) {
    return this.invitationsService.getSentInvitations(user.id);
  }

  @Delete(':id')
  @Roles('CLIENT')
  @ApiOperation({ summary: 'Retract a pending invitation' })
  retractInvitation(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.invitationsService.retractInvitation(id, user.id);
  }
}