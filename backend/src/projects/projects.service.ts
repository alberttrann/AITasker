import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MatchingService } from './matching.service';
import { FastapiClient } from '../elicitation/fastapi.client';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly matchingService: MatchingService,
    private readonly fastapiClient: FastapiClient,
  ) {}

  async findProject(
    projectId: string,
    userId: string,
    activeRole: 'CLIENT' | 'EXPERT' | 'ADMIN',
    clientSubtype?: 'CEO' | 'TECH_TEAM',
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        clientId: true,
        state: true,
        archetype: true,
        tier: true,
        artifactAJson: true,
        projectName: true,
        requiredDomainsJson: true,
        requiredSeamsJson: true,
        milestoneFrameworkJson: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (activeRole === 'ADMIN') {
      return this.mapProjectResponse(project);
    }

    if (project.state !== 'PUBLISHED') {
      const isOwnerOrLinkedTech = await this.checkClientOwnership(
        project,
        userId,
        activeRole,
        clientSubtype,
      );
      if (!isOwnerOrLinkedTech) {
        throw new ForbiddenException('Access denied. This project spec is not yet published.');
      }
    }

    const isAuthorized = await this.isUserAuthorized(project, userId, activeRole, clientSubtype);
    if (!isAuthorized) {
      throw new ForbiddenException('Access denied. You are not a member of this project.');
    }

    return this.mapProjectResponse(project);
  }

  async findProjectArtifactA(
    projectId: string,
    userId: string,
    activeRole: 'CLIENT' | 'EXPERT' | 'ADMIN',
    clientSubtype?: 'CEO' | 'TECH_TEAM',
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, clientId: true, state: true, artifactAJson: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (activeRole === 'ADMIN') {
      return { artifact_a_json: project.artifactAJson };
    }

    if (project.state !== 'PUBLISHED') {
      const isOwnerOrLinkedTech = await this.checkClientOwnership(
        project,
        userId,
        activeRole,
        clientSubtype,
      );
      if (!isOwnerOrLinkedTech) {
        throw new ForbiddenException('Artifact A is only available on published projects.');
      }
    }

    const isAuthorized = await this.isUserAuthorized(project, userId, activeRole, clientSubtype);
    if (!isAuthorized) {
      throw new ForbiddenException('Access denied. You are not matched with this project.');
    }

    return { artifact_a_json: project.artifactAJson };
  }

  async findProjectArtifactB(
    projectId: string,
    userId: string,
    activeRole: 'CLIENT' | 'EXPERT' | 'ADMIN',
    clientSubtype?: 'CEO' | 'TECH_TEAM',
  ) {
    // "requester.active_role = CLIENT/CEO → 403 permanent" — checked
    // FIRST, before even looking up the project. No CEO ever gets Artifact B.
    if (activeRole === 'CLIENT' && clientSubtype === 'CEO') {
      throw new ForbiddenException(
        'CEOs cannot access Artifact B — this is the technical deep-dive ' +
          'spec for matched experts and tech teams only.',
      );
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, artifactBJson: true },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    if (activeRole === 'ADMIN') {
      return { artifact_b_json: project.artifactBJson };
    }

    let engagement: any;

    if (activeRole === 'EXPERT') {
      engagement = await this.prisma.engagement.findFirst({
        where: { projectId, expertId: userId },
        include: { capabilityBid: true },
      });
      if (!engagement) {
        throw new ForbiddenException('You are not engaged with this project.');
      }
    } else if (clientSubtype === 'TECH_TEAM') {
      const techProfile = await this.prisma.techTeamProfile.findUnique({ where: { userId } });
      if (!techProfile || techProfile.linkedProjectId !== projectId) {
        throw new ForbiddenException('You are not linked to this project.');
      }
      engagement = await this.prisma.engagement.findFirst({
        where: { projectId, state: { in: ['ACTIVE', 'CONNECTED'] } },
        include: { capabilityBid: true },
      });
      if (!engagement) {
        throw new ForbiddenException(
          'No engagement on this project has progressed far enough yet.',
        );
      }
    } else {
      throw new ForbiddenException('Access denied.');
    }

    const bidState = engagement.capabilityBid?.state ?? 'DRAFT';

    let guardResult;
    try {
      guardResult = await this.fastapiClient.checkArtifactBAccess(projectId, {
        engagement_state: engagement.state,
        bid_state: bidState,
        expert_nda_accepted: !!engagement.expertNdaAcceptedAt,
        ceo_nda_accepted: !!engagement.clientNdaAcceptedAt,
      });
    } catch (err: any) {
      if (err.response?.status === 403) {
        throw new ForbiddenException(
          err.response.data?.detail ?? 'Artifact B is not yet accessible for this engagement.',
        );
      }
      throw new ServiceUnavailableException(
        'Could not verify Artifact B access — please try again.',
      );
    }

    return { artifact_b_json: project.artifactBJson };
  }

  async getMatchingShortlist(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, clientId: true, state: true },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    if (project.clientId !== userId) {
      throw new ForbiddenException('Only the project owner may view the shortlist.');
    }
    if (project.state !== 'PUBLISHED') {
      throw new UnprocessableEntityException('Project is not yet published.');
    }

    const shortlist = await this.matchingService.getShortlist(projectId);
    // strip composite_score before returning
    // numeric scores must never reach the frontend, labels/colors only.
    return await this.matchingService.mapShortlistForFrontend(shortlist ?? [], projectId);
  }

  private mapProjectResponse(project: any) {
    return {
      id: project.id,
      state: project.state,
      archetype: project.archetype,
      tier: project.tier,
      artifact_a_json: project.artifactAJson,
      projectName: project.projectName,
      required_domains_json: project.requiredDomainsJson ?? [],
      required_seams_json: project.requiredSeamsJson ?? [],
      milestone_framework_json: project.milestoneFrameworkJson ?? [],
    };
  }

  private async checkClientOwnership(
    project: any,
    userId: string,
    activeRole: string,
    clientSubtype?: string,
  ): Promise<boolean> {
    if (activeRole !== 'CLIENT') return false;

    if (clientSubtype === 'CEO' && project.clientId === userId) {
      return true;
    }

    if (clientSubtype === 'TECH_TEAM') {
      const techProfile = await this.prisma.techTeamProfile.findUnique({
        where: { userId: userId },
      });
      if (techProfile && techProfile.linkedProjectId === project.id) {
        return true;
      }
    }

    return false;
  }

  private async isUserAuthorized(
    project: any,
    userId: string,
    activeRole: 'CLIENT' | 'EXPERT' | 'ADMIN',
    clientSubtype?: 'CEO' | 'TECH_TEAM',
  ): Promise<boolean> {
    if (activeRole === 'CLIENT') {
      return this.checkClientOwnership(project, userId, activeRole, clientSubtype);
    }

    // any EXPERT may view Artifact A on a published project —
    // no prior engagement or shortlist required. This method only runs
    // once the caller has already cleared the PUBLISHED-state check
    // above it, so reaching here as a non-owning EXPERT already implies
    // the project is published.
    if (activeRole === 'EXPERT') {
      return true;
    }

    return false;
  }

  /**
   * @param slim When true, returns only lightweight scalar fields — no JSONBs.
   *             Cuts payload ~80% for list/card views.
   *             Full record (artifactAJson, etc.) should be fetched via GET /projects/:id.
   */
  async getProjects(userId: string, activeRole: string, clientSubtype?: string, slim = false) {
    const slimSelect = slim
      ? {
          id: true,
          projectName: true,
          state: true,
          archetype: true,
          tier: true,
          selfTechnical: true,
          createdAt: true,
        }
      : undefined;

    const fullInclude = slim
      ? undefined
      : {
          _count: {
            select: { engagements: { where: { type: 'PROJECT_BASED' } } },
          },
        };

    const queryOptions = slim ? { select: slimSelect } : { include: fullInclude };

    if (activeRole === 'CLIENT' && clientSubtype === 'CEO') {
      if (slim) {
        return this.prisma.project.findMany({
          where: { clientId: userId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            projectName: true,
            state: true,
            archetype: true,
            tier: true,
            selfTechnical: true,
            createdAt: true,
          },
        });
      }
      return this.prisma.project.findMany({
        where: { clientId: userId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { engagements: { where: { type: 'PROJECT_BASED' } } } } },
      });
    }
    if (activeRole === 'CLIENT' && clientSubtype === 'TECH_TEAM') {
      const tech = await this.prisma.techTeamProfile.findUnique({ where: { userId } });
      if (!tech?.linkedProjectId) return [];
      if (slim) {
        return this.prisma.project.findMany({
          where: { id: tech.linkedProjectId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            projectName: true,
            state: true,
            archetype: true,
            tier: true,
            selfTechnical: true,
            createdAt: true,
          },
        });
      }
      return this.prisma.project.findMany({
        where: { id: tech.linkedProjectId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { engagements: { where: { type: 'PROJECT_BASED' } } } } },
      });
    }
    return [];
  }

  async updateProjectName(projectId: string, userId: string, projectName: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.clientId !== userId)
      throw new ForbiddenException('Only the owner can rename the project');

    return this.prisma.project.update({
      where: { id: projectId },
      data: { projectName },
      select: { id: true, projectName: true }, // Trả về gọn nhẹ cho FE
    });
  }

  async updateProjectMilestones(projectId: string, userId: string, milestones: any[]) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    if (project.clientId !== userId) {
      throw new ForbiddenException('Only the project owner can update project milestones');
    }

    return this.prisma.project.update({
      where: { id: projectId },
      data: { milestoneFrameworkJson: milestones },
      select: { id: true, milestoneFrameworkJson: true },
    });
  }

  async milestoneChatHandler(
    projectId:     string,
    userId:        string,
    message:       string,
    chatSessionId?: string,
    currentMilestones?: any[],
  ) {
    // Auth & Data Fetching 
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { 
        techTeamProfiles: { select: { userId: true } },
        // Lấy kèm hợp đồng đang Active để xem có Milestone thật dưới DB chưa
        engagements: {
          where: { state: { notIn: ['PENDING', 'DECLINED', 'CANCELLED'] } },
          include: {
            milestones: {
              orderBy: { milestoneNumber: 'asc' },
              include: { acceptanceCriteria: true }
            }
          },
          take: 1
        }
      },
    });

    if (!project) throw new NotFoundException('Project not found.');

    const isCeo      = project.clientId === userId;
    const isTechTeam = project.techTeamProfiles.some((t) => t.userId === userId);
    if (!isCeo && !isTechTeam) {
      throw new ForbiddenException(
        'Only the project CEO or assigned Tech Team can use the milestone assistant.',
      );
    }

    // Xác định nguồn dữ liệu Milestone cho Chatbot đọc 
    let frameworkToUse: any = project.milestoneFrameworkJson;

    // 1. Nếu dự án đã có hợp đồng và có Milestone thật dưới DB -> Ưu tiên dùng hàng thật
    if (project.engagements && project.engagements.length > 0 && project.engagements[0].milestones.length > 0) {
      // Map data từ DB về chuẩn JSON mà AI Model đang hiểu
      frameworkToUse = project.engagements[0].milestones.map(m => ({
        milestone_number: m.milestoneNumber,
        deliverable_statement: m.deliverableStatement,
        sign_off_authority: m.signOffAuthority,
        payment_amount_vnd: Number(m.paymentAmountVnd),
        state: m.state,
        criteria: m.acceptanceCriteria.map(c => c.criterionText)
      }));
    }

    // 2. Nếu Frontend có truyền lên mảng Local State (chỉnh sửa nháp chưa save) -> Ưu tiên cao nhất
    if (currentMilestones && currentMilestones.length > 0) {
      frameworkToUse = currentMilestones;
    }

    // Load or create session
    let session: { id: string; title: string | null; messagesJson: unknown };

    if (chatSessionId) {
      const found = await this.prisma.milestoneChatSession.findFirst({
        where: { id: chatSessionId, projectId, userId },
      });
      if (!found) throw new NotFoundException('Chat session not found or does not belong to you.');
      session = found;
    } else {
      const dateLabel = new Date().toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      });
      session = await this.prisma.milestoneChatSession.create({
        data: {
          projectId,
          userId,
          title:       `Chat · ${dateLabel}`,
          messagesJson: [],
        },
      });
    }

    type ChatMessage = { role: 'user' | 'assistant'; content: string };
    const history = (session.messagesJson as ChatMessage[]) ?? [];

    // Append user turn, call AI, append assistant turn
    const historyWithUserMsg: ChatMessage[] = [
      ...history,
      { role: 'user', content: message },
    ];

    const budgetContext = project.estimatedTotalCostVnd
      ? `Estimated total: ${project.estimatedTotalCostVnd.toString()} VND` +
        (project.estimatedTotalDurationDays
          ? ` over ${project.estimatedTotalDurationDays} working days`
          : '')
      : 'No budget estimate available';

    const aiResponse = await this.fastapiClient.milestoneChatAssist({
      artifact_a:           (project.artifactAJson ?? {})          as Record<string, unknown>,
      milestone_framework:  (frameworkToUse ?? [])                 as Array<Record<string, unknown>>,
      budget_context:       budgetContext,
      conversation_history: historyWithUserMsg,   
      user_message:         message,              
    });

    const finalHistory: ChatMessage[] = [
      ...historyWithUserMsg,
      { role: 'assistant', content: aiResponse.reply },
    ];

    // Persist updated history
    await this.prisma.milestoneChatSession.update({
      where: { id: session.id },
      data:  { messagesJson: finalHistory as any, updatedAt: new Date() },
    });

    return {
      reply:          aiResponse.reply,
      suggestedEdit:  aiResponse.suggested_edit,
      chatSessionId:  session.id,
      sessionTitle:   session.title,
      messageCount:   finalHistory.length,
    };
  }

  // List all chat sessions for a project (for the session sidebar)
  async listMilestoneChatSessions(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { techTeamProfiles: { select: { userId: true } } },
    });
    if (!project) throw new NotFoundException('Project not found.');

    const isCeo = project.clientId === userId;
    const isTechTeam = project.techTeamProfiles.some((t) => t.userId === userId);
    if (!isCeo && !isTechTeam) throw new ForbiddenException('Access denied.');

    return this.prisma.milestoneChatSession
      .findMany({
        where: { projectId, userId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          // Return message count, not the full history, for the list view
          messagesJson: true,
        },
      })
      .then((sessions) =>
        sessions.map((s) => ({
          id: s.id,
          title: s.title,
          messageCount: (s.messagesJson as unknown[]).length,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        })),
      );
  }

  // Get full history for a specific session
  async getMilestoneChatSession(projectId: string, sessionId: string, userId: string) {
    const session = await this.prisma.milestoneChatSession.findFirst({
      where: { id: sessionId, projectId, userId },
    });
    if (!session) throw new NotFoundException('Chat session not found.');
    return session;
  }

  async getMarketplaceProjects(filters: { archetype?: string; tier?: string; limit?: number }) {
    const projects = await this.prisma.project.findMany({
      where: {
        state: 'PUBLISHED',
        ...(filters.archetype ? { archetype: filters.archetype } : {}),
        ...(filters.tier      ? { tier: filters.tier }           : {}),
      },
      select: {
        id: true,
        projectName: true,
        state: true,
        archetype: true,
        tier: true,
        createdAt: true,
        requiredDomainsJson: true,
        requiredSeamsJson: true,
        artifactAJson: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(filters.limit ?? 20, 50),
    });

    return projects.map((p) => this.mapProjectResponse(p));
  }

  async updateMilestoneFramework(projectId: string, userId: string, milestoneFramework: any[]) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        engagements: {
          where: { state: { in: ['CONNECTED', 'ACTIVE', 'DISPUTED'] } },
          include: {
            milestones: {
              include: { acceptanceCriteria: true },
            },
          },
          take: 1,
        },
      },
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.clientId !== userId) {
      throw new ForbiddenException('Only the project owner can update the milestone framework.');
    }
    if (project.state !== 'PUBLISHED' && project.state !== 'DRAFT') {
      throw new UnprocessableEntityException('Can only edit milestone framework for active projects.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id: projectId },
        data:  { milestoneFrameworkJson: milestoneFramework as any },
        select: { id: true, milestoneFrameworkJson: true },
      });

      const activeEngagement = project.engagements?.[0];

      if (activeEngagement) {
        const incomingNumbers = milestoneFramework.map(m => intOrNull(m.milestone_number)).filter(Boolean);
        const existingMilestones = activeEngagement.milestones;

        const toDelete = existingMilestones.filter(
          m => !incomingNumbers.includes(m.milestoneNumber) && m.state === 'DEFINED'
        );
        for (const m of toDelete) {
          await tx.acceptanceCriterion.deleteMany({ where: { milestoneId: m.id } });
          await tx.milestone.delete({ where: { id: m.id } });
        }

        for (const item of milestoneFramework) {
          const mNum = intOrNull(item.milestone_number);
          if (!mNum) continue;

          const existing = existingMilestones.find(m => m.milestoneNumber === mNum);

          if (existing) {
            if (existing.state === 'DEFINED') {
              await tx.milestone.update({
                where: { id: existing.id },
                data: {
                  deliverableStatement: item.deliverable_statement,
                  signOffAuthority:     item.sign_off_authority,
                  paymentAmountVnd:     BigInt(item.payment_amount_vnd || 0),
                  estimatedDurationDays: item.estimated_duration_days || null,
                  estimatedCostVnd:     BigInt(item.estimated_cost_vnd || 0),
                  updatedAt:            new Date(),
                },
              });

              await tx.acceptanceCriterion.deleteMany({ where: { milestoneId: existing.id } });
              for (const cText of (item.criteria ?? [])) {
                await tx.acceptanceCriterion.create({
                  data: {
                    milestone:      { connect: { id: existing.id } },
                    criterionText:  cText,
                    isRequired:     true,
                    verifiedByRole: item.sign_off_authority,
                  },
                });
              }
            }
          } else {
            const newMilestone = await tx.milestone.create({
              data: {
                engagementId:         activeEngagement.id,
                milestoneNumber:      mNum,
                deliverableStatement: item.deliverable_statement,
                signOffAuthority:     item.sign_off_authority,
                paymentAmountVnd:     BigInt(item.payment_amount_vnd || 0),
                estimatedDurationDays: item.estimated_duration_days || null,
                estimatedCostVnd:     BigInt(item.estimated_cost_vnd || 0),
                state:                'DEFINED',
              },
            });

            for (const cText of (item.criteria ?? [])) {
              await tx.acceptanceCriterion.create({
                data: {
                  milestone:      { connect: { id: newMilestone.id } },
                  criterionText:  cText,
                  isRequired:     true,
                  verifiedByRole: item.sign_off_authority,
                },
              });
            }
          }
        }
      }

      return updatedProject;
    });
  }
}

function intOrNull(val: any): number | null {
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? null : parsed;
}
