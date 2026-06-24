import { PrismaService } from "prisma/prisma.service";
import { CreateMessageDto } from "./dto/create-message.dto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { AbstractHttpAdapter } from "@nestjs/core";
import { timestamp } from "rxjs";
import { accessSync } from "fs";

@Injectable()
export class MessagesService {
    constructor (private readonly prisma : PrismaService) {}

    async createMessage (senderId : string ,dto : CreateMessageDto) {
        return this.prisma.message.create({
            data: {
                engagementId : dto.engagement_id,
                senderId : senderId,
                content : dto.content,
                attachmentUrl : dto.attachment_url || null,
            },
            include : { 
                sender : {
                    select : {
                        id : true,
                        email : true,
                        fullName : true,
                        activeRole : true,
                    },
                },
            },
        });
    }

    async getChatHistory (engagementId : string) {
        const engagement = this.prisma.message.findUnique({
            where : { id: engagementId },
    });

        if (!engagement)
            throw new NotFoundException('Engagement cannot be found in database.');
        
        return this.prisma.message.findMany({
            where : { engagementId } ,
            orderBy : { timestamp : 'asc'},
            include : {
                sender: {
                        select : {
                        id : true,
                        email : true,
                        fullName : true,
                        activeRole : true,
                    },
                },
            },
        });
    }

    async markAsRead (messageId : string, userId : string) {
        const message = this.prisma.message.findUnique({
            where : {id : messageId},
        });

        if (!message) {
            throw new NotFoundException('Message not found in Database');
        }

        // Sử dụng upsert để phòng tránh lỗi ghi trùng bản ghi 
        // do ràng buộc duy nhất (message_id, user_id)
        return this.prisma.messageRead.upsert({
            where : {
                messageId_userId: { // Khóa phức hợp được sinh tự động bởi Prisma
                    messageId,
                    userId,
                },
            },
            update : {}, // Nếu đã tồn tại bản ghi đánh dấu đã đọc thì không cập nhật gì thêm
            create : {
                messageId,
                userId,
            },
        });
    }

    async unreadCount (engagementId : string, userId: string) {
        return this.prisma.message.count({
            where : { 
                id : engagementId,
                senderId : {not: userId},
                messageReads: {
                    none: {
                        userId, // Chưa tồn tại bản ghi nào đánh dấu là đã đọc của user hiện tại
                    },
                },
            },
        });
    }

}
 
