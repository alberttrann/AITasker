import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMyNotifications(userId: string, limit = 50, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      select: { id: true, type: true, title: true, body: true, link: true, isRead: true, createdAt: true },
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unread_count: count };
  }

  async markRead(notificationId: string, userId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notif) throw new NotFoundException('Notification not found.');
    if (notif.userId !== userId) throw new ForbiddenException('Not your notification.');
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { marked_read: count };
  }

  async deleteNotification(notificationId: string, userId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notif) throw new NotFoundException('Notification not found.');
    if (notif.userId !== userId) throw new ForbiddenException('Not your notification.');
    await this.prisma.notification.delete({ where: { id: notificationId } });
    return { deleted: true };
  }
}