import { PrismaService } from "../database/prisma.service";
import { CreateMessageDto } from "./dto/create-message.dto";
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common";

type ActorUser = { id: string; activeRole: string };

@Injectable()
export class MessagesService {
    constructor(private readonly prisma: PrismaService) {}

    async assertPartyToEngagement(engagementId: string, userId: string) {
        const engagement = await this.prisma.engagement.findUnique({
            where: { id: engagementId },
        });
        if (!engagement) {
            throw new NotFoundException('Engagement not found.');
        }

        const isClient = engagement.clientId === userId;
        const isExpert = engagement.expertId === userId;

        let isTechTeam = false;
        if (engagement.projectId) {
            const techProfile = await this.prisma.techTeamProfile.findUnique({
                where: { userId },
            });
            isTechTeam = techProfile?.linkedProjectId === engagement.projectId;
        }

        if (!isClient && !isExpert && !isTechTeam) {
            throw new ForbiddenException('You are not a party to this engagement.');
        }

        return engagement;
    }

    async assertPartyToProject(projectId: string, user: ActorUser) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
        });
        if (!project) {
            throw new NotFoundException('Project not found.');
        }
        if (project.state !== 'PUBLISHED') {
            throw new ForbiddenException('This project is not open for questions.');
        }

        if (project.clientId === user.id) {
            return project;   // CEO answering on their own project
        }

        if (user.activeRole === 'EXPERT') {
            return project;                                  
        }

        const techProfile = await this.prisma.techTeamProfile.findUnique({
            where: { userId: user.id },
        });
        if (techProfile?.linkedProjectId === projectId) {
            return project;   // linked TECH_TEAM answering
        }

        throw new ForbiddenException('You are not authorized to message on this project.');
    }

    async createMessage(sender: ActorUser, dto: CreateMessageDto) {
        const hasEngagement = !!dto.engagement_id;
        const hasProject    = !!dto.project_id;

        if (hasEngagement === hasProject) {
            throw new BadRequestException(
                'Exactly one of engagement_id or project_id must be provided.',
            );
        }

        if (hasEngagement) {
            await this.assertPartyToEngagement(dto.engagement_id!, sender.id);
        } else {
            await this.assertPartyToProject(dto.project_id!, sender);
        }

        return this.prisma.message.create({
            data: {
                engagementId:  dto.engagement_id ?? null,
                projectId:     dto.project_id ?? null,
                senderId:      sender.id,
                content:       dto.content,
                attachmentUrl: dto.attachment_url || null,
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        email: true,
                        fullName: true,
                        activeRole: true,
                    },
                },
            },
        });
    }

    async getChatHistory(
        engagementId: string,
        userId: string,
        limit: number = 50,
        cursorId?: string,
    ) {
        await this.assertPartyToEngagement(engagementId, userId);

        return this.prisma.message.findMany({
            where: { engagementId },
            orderBy: { timestamp: 'asc' },
            take: limit,
            ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
            include: {
                sender: {
                    select: {
                        id: true,
                        email: true,
                        fullName: true,
                        activeRole: true,
                    },
                },
            },
        });
    }

    // project-scoped chat history, the pre-bid thread's read side.
    async getProjectChatHistory(
        projectId: string,
        user: ActorUser,
        limit: number = 50,
        cursorId?: string,
    ) {
        await this.assertPartyToProject(projectId, user);

        return this.prisma.message.findMany({
            where: { projectId },
            orderBy: { timestamp: 'asc' },
            take: limit,
            ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
            include: {
                sender: {
                    select: {
                        id: true,
                        email: true,
                        fullName: true,
                        activeRole: true,
                    },
                },
            },
        });
    }

    async markAsRead(messageId: string, userId: string) {
        const message = await this.prisma.message.findUnique({
            where: { id: messageId },
        });

        if (!message) {
            throw new NotFoundException('Message not found in Database');
        }

        return this.prisma.messageRead.upsert({
            where: {
                messageId_userId: {
                    messageId,
                    userId,
                },
            },
            update: {},
            create: {
                messageId,
                userId,
            },
        });
    }

    async unreadCount(engagementId: string, userId: string) {
        return this.prisma.message.count({
            where: {
                engagementId: engagementId,
                senderId: { not: userId },
                reads: {
                    none: {
                        userId,
                    },
                },
            },
        });
    }

    async getConversations(user: { id: string; activeRole: string; clientSubtype?: string | null }) {
        // Build OR conditions based on the user's role
        const orConditions: any[] = [
            { clientId: user.id },
            { expertId: user.id },
        ];

        // TECH_TEAM users: find engagements linked to their project
        if (user.clientSubtype === 'TECH_TEAM') {
            const techProfile = await this.prisma.techTeamProfile.findUnique({
                where: { userId: user.id },
            });
            if (techProfile?.linkedProjectId) {
                orConditions.push({ projectId: techProfile.linkedProjectId });
            }
        }

        const engagements = await this.prisma.engagement.findMany({
            where: {
                OR: orConditions,
                state: { not: 'DECLINED' },
            },
            select: {
                id: true, 
                state: true, 
                projectId: true,
                clientId: true,
                expertId: true,
                project: { select: { projectName: true } },
                expert:  { select: { id: true, fullName: true, email: true } }, // Thêm email phục vụ Modal
                client:  { select: { id: true, fullName: true, email: true } }, // Thêm email phục vụ Modal
            },
            orderBy: { id: 'desc' }, 
            take: 20,
        });

        const threads = (await Promise.all(engagements.map(async (eng) => {
            const lastMessage = await this.prisma.message.findFirst({
                where: { engagementId: eng.id },
                orderBy: { timestamp: 'desc' }, 
                select: { content: true, timestamp: true, senderId: true }, 
            });
            const unread = await this.prisma.message.count({
                where: { engagementId: eng.id, senderId: { not: user.id }, reads: { none: { userId: user.id } } }, 
            });

            // Xác định otherParty
            let otherParty: any = null;
            if (eng.clientId === user.id) {
                otherParty = eng.expert;
            } else if (eng.expertId === user.id) {
                otherParty = eng.client;
            } else {
                otherParty = eng.client || eng.expert;
            }

            // [BACK-1] Ngăn chặn Ghost Conversations: Loại bỏ các bản ghi không hợp lệ hoặc đã bị xóa
            if (!otherParty) return null;
            if (eng.projectId && !eng.project) return null;

            return {
                type:        'engagement',
                id:          eng.id,
                projectName: eng.project?.projectName ?? 'Service Purchase Workspace',
                otherParty: {
                    id: otherParty.id,
                    fullName: otherParty.fullName,
                    email: otherParty.email ?? '',
                },
                lastMessage, 
                unreadCount: unread,
            };
        }))).filter(Boolean); // Lọc bỏ hoàn toàn các giá trị null

        return threads.sort((a, b) =>
            (b.lastMessage?.timestamp?.getTime() ?? 0) - (a.lastMessage?.timestamp?.getTime() ?? 0), 
        );
    }

    async projectUnreadCount(projectId: string, userId: string) {
        return this.prisma.message.count({
            where: { projectId, senderId: { not: userId }, readAt: null },
        });
    }
}