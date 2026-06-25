import { PrismaService } from "../database/prisma.service";
import { CreateMessageDto } from "./dto/create-message.dto";
import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common";

@Injectable()
export class MessagesService {
    constructor(private readonly prisma: PrismaService) {}

    // ADDED — shared party check, used by createMessage, getChatHistory,
    // and (publicly) by MessagesGateway's joinRoom handler. No such check
    // existed anywhere before this fix — any authenticated user could read,
    // join, or post into ANY engagement's chat.
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

    async createMessage(senderId: string, dto: CreateMessageDto) {
        // ADDED — party check before allowing a message to be created.
        await this.assertPartyToEngagement(dto.engagement_id, senderId);

        return this.prisma.message.create({
            data: {
                engagementId: dto.engagement_id,
                senderId: senderId,
                content: dto.content,
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

    // CHANGED: was querying prisma.message (wrong table) with no await
    // (the existence check was a permanent no-op either way). Now
    // correctly checks the Engagement table, properly awaited, AND adds
    // the party check that was entirely missing before. Also wires up
    // the limit/cursorId pagination that the controller already parses
    // but previously never passed through.
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

    async markAsRead(messageId: string, userId: string) {
        // FIX: was missing `await` — the existence check below never
        // actually fired, since a Promise object is always truthy.
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
        // FIX: was filtering by `id: engagementId` — a Message's OWN
        // primary key compared against an Engagement's id, which can
        // never match anything real. Should filter by the actual foreign
        // key, engagementId.
        return this.prisma.message.count({
            where: {
                engagementId: engagementId,
                senderId: { not: userId },
                messageReads: {
                    none: {
                        userId,
                    },
                },
            },
        });
    }
}