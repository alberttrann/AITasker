import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { addDays } from 'date-fns';

@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new invitation or resets an existing one to PENDING.
   * Called from MessagesGateway.handleInviteExpert every time the CEO
   * fires the "inviteExpert" socket event.
   */
  async upsertInvitation(data: {
    projectId: string;
    expertId:  string;
    ceoId:     string;
    message?:  string | null;
  }) {
    const expiresAt = addDays(new Date(), 7);

    return this.prisma.invitation.upsert({
      where: {
        projectId_expertId: {
          projectId: data.projectId,
          expertId:  data.expertId,
        },
      },
      create: {
        projectId: data.projectId,
        expertId:  data.expertId,
        ceoId:     data.ceoId,
        message:   data.message ?? null,
        status:    'PENDING',
        expiresAt,
      },
      update: {
        // Re-inviting a declined expert resets the invitation
        status:      'PENDING',
        ceoId:       data.ceoId,
        message:     data.message ?? null,
        invitedAt:   new Date(),
        expiresAt,
        respondedAt: null,
      },
    });
  }

  /**
   * GET /invitations — Expert sees all projects they've been invited to,
   * with full project metadata for the table view.
   */
  async getExpertInvitations(expertId: string) {
    const invitations = await this.prisma.invitation.findMany({
      where:   { expertId },
      include: {
        project: {
          select: {
            id:                  true,
            projectName:         true,
            state:               true,
            archetype:           true,
            tier:                true,
            createdAt:           true,
            requiredDomainsJson: true,
            requiredSeamsJson:   true,
          },
        },
        ceo: {
          select: { id: true, fullName: true },
        },
      },
      orderBy: { invitedAt: 'desc' },
    });

    // Compute isExpired on-the-fly without a background job
    const now = new Date();
    return invitations.map((inv) => ({
      ...inv,
      isExpired:
        inv.status === 'PENDING' &&
        inv.expiresAt !== null &&
        inv.expiresAt < now,
    }));
  }

  /**
   * POST /invitations/:id/decline — Expert explicitly declines an invitation.
   */
  async declineInvitation(invitationId: string, expertId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }
    if (invitation.expertId !== expertId) {
      throw new ForbiddenException('This invitation does not belong to you.');
    }
    if (invitation.status !== 'PENDING') {
      throw new UnprocessableEntityException(
        `Cannot decline an invitation in status '${invitation.status}'.`,
      );
    }

    return this.prisma.invitation.update({
      where: { id: invitationId },
      data:  { status: 'DECLINED', respondedAt: new Date() },
    });
  }

  /**
   * Called internally by BidsService when an expert submits a bid.
   * Uses updateMany so it silently no-ops if no invitation record exists
   * (expert can bid without having been explicitly invited).
   */
  async markAccepted(projectId: string, expertId: string) {
    await this.prisma.invitation.updateMany({
      where: { projectId, expertId, status: 'PENDING' },
      data:  { status: 'ACCEPTED', respondedAt: new Date() },
    });
  }
}