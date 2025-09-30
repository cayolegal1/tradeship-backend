import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import {
  NotificationResponseDto,
  NotificationStatsResponseDto,
} from './dto/notification-response.dto';
import {
  PaginationDto,
  PaginatedResponseDto,
} from '../common/dto/pagination.dto';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  private convertNotificationToResponseDto(
    notification: any,
  ): NotificationResponseDto {
    return new NotificationResponseDto({
      ...notification,
      metadata: notification.metadata as Record<string, any>,
    });
  }

  async createNotification(
    createNotificationDto: CreateNotificationDto,
  ): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.create({
      data: {
        ...createNotificationDto,
        expiresAt: createNotificationDto.expiresAt
          ? new Date(createNotificationDto.expiresAt)
          : null,
      },
    });

    return this.convertNotificationToResponseDto(notification);
  }

  async getUserNotifications(
    userId: string,
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<NotificationResponseDto>> {
    const { page, limit, skip } = paginationDto;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({
        where: { recipientId: userId },
      }),
    ]);

    const notificationDtos = notifications.map((notification) =>
      this.convertNotificationToResponseDto(notification),
    );
    const meta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return new PaginatedResponseDto(notificationDtos, meta);
  }

  async getUnreadNotifications(
    userId: string,
  ): Promise<NotificationResponseDto[]> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        recipientId: userId,
        isRead: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    return notifications.map((notification) =>
      this.convertNotificationToResponseDto(notification),
    );
  }

  async markAsRead(
    userId: string,
    markReadDto: MarkReadDto,
  ): Promise<{ message: string }> {
    const { isRead, notificationIds } = markReadDto;

    // Verify all notifications belong to the user
    const notifications = await this.prisma.notification.findMany({
      where: {
        id: { in: notificationIds },
        recipientId: userId,
      },
    });

    if (notifications.length !== notificationIds.length) {
      throw new BadRequestException(
        "Some notification IDs are invalid or don't belong to you",
      );
    }

    // Update notifications
    await this.prisma.notification.updateMany({
      where: {
        id: { in: notificationIds },
        recipientId: userId,
      },
      data: {
        isRead,
        readAt: isRead ? new Date() : null,
      },
    });

    return {
      message: `Notifications marked as ${isRead ? 'read' : 'unread'} successfully`,
    };
  }

  async markAllAsRead(userId: string): Promise<{ message: string }> {
    await this.prisma.notification.updateMany({
      where: {
        recipientId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      message: 'All notifications marked as read',
    };
  }

  async deleteNotification(
    userId: string,
    notificationId: string,
  ): Promise<{ message: string }> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        recipientId: userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return {
      message: 'Notification deleted successfully',
    };
  }

  async getNotificationStats(
    userId: string,
  ): Promise<NotificationStatsResponseDto> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalNotifications,
      unreadNotifications,
      readNotifications,
      notificationsToday,
      notificationsThisWeek,
      notificationsThisMonth,
      recentNotifications,
      byTypeStats,
    ] = await Promise.all([
      this.prisma.notification.count({
        where: { recipientId: userId },
      }),
      this.prisma.notification.count({
        where: { recipientId: userId, isRead: false },
      }),
      this.prisma.notification.count({
        where: { recipientId: userId, isRead: true },
      }),
      this.prisma.notification.count({
        where: {
          recipientId: userId,
          createdAt: { gte: today },
        },
      }),
      this.prisma.notification.count({
        where: {
          recipientId: userId,
          createdAt: { gte: weekAgo },
        },
      }),
      this.prisma.notification.count({
        where: {
          recipientId: userId,
          createdAt: { gte: monthAgo },
        },
      }),
      this.prisma.notification.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.notification.groupBy({
        by: ['notificationTypeId'],
        where: { recipientId: userId },
        _count: { id: true },
      }),
    ]);

    // Get notification type names for byType stats
    const notificationTypes = await this.prisma.notificationType.findMany({
      where: { id: { in: byTypeStats.map((stat) => stat.notificationTypeId) } },
    });

    const byType: Record<string, number> = {};
    byTypeStats.forEach((stat) => {
      const type = notificationTypes.find(
        (t) => t.id === stat.notificationTypeId,
      );
      if (type) {
        byType[type.name] = stat._count.id;
      }
    });

    return new NotificationStatsResponseDto({
      totalNotifications,
      unreadNotifications,
      readNotifications,
      notificationsToday,
      notificationsThisWeek,
      notificationsThisMonth,
      byType,
      recentNotifications: recentNotifications.map((n) =>
        this.convertNotificationToResponseDto(n),
      ),
    });
  }

  async getNotificationTypes(): Promise<any[]> {
    return this.prisma.notificationType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getUserNotificationSettings(userId: string): Promise<any[]> {
    return this.prisma.notificationUserSettings.findMany({
      where: { userId },
      include: {
        notificationType: true,
      },
    });
  }

  async updateNotificationSettings(
    userId: string,
    settings: Array<{
      notificationTypeId: string;
      emailEnabled: boolean;
      pushEnabled: boolean;
      inAppEnabled: boolean;
    }>,
  ): Promise<{ message: string }> {
    // Update or create settings for each notification type
    for (const setting of settings) {
      await this.prisma.notificationUserSettings.upsert({
        where: {
          userId_notificationTypeId: {
            userId,
            notificationTypeId: setting.notificationTypeId,
          },
        },
        update: {
          emailEnabled: setting.emailEnabled,
          pushEnabled: setting.pushEnabled,
          inAppEnabled: setting.inAppEnabled,
        },
        create: {
          userId,
          notificationTypeId: setting.notificationTypeId,
          emailEnabled: setting.emailEnabled,
          pushEnabled: setting.pushEnabled,
          inAppEnabled: setting.inAppEnabled,
        },
      });
    }

    return {
      message: 'Notification settings updated successfully',
    };
  }

  async sendNotificationToUser(
    recipientId: string,
    notificationTypeName: string,
    title: string,
    message: string,
    options?: {
      senderId?: string;
      contentType?: string;
      objectId?: string;
      metadata?: Record<string, any>;
      actionUrl?: string;
      expiresAt?: Date;
    },
  ): Promise<NotificationResponseDto> {
    // Get notification type
    const notificationType = await this.prisma.notificationType.findUnique({
      where: { name: notificationTypeName },
    });

    if (!notificationType) {
      throw new NotFoundException('Notification type not found');
    }

    // Create notification
    const notification = await this.prisma.notification.create({
      data: {
        recipientId,
        senderId: options?.senderId,
        notificationTypeId: notificationType.id,
        title,
        message,
        contentType: options?.contentType,
        objectId: options?.objectId,
        metadata: options?.metadata || {},
        actionUrl: options?.actionUrl,
        expiresAt: options?.expiresAt,
      },
    });

    return this.convertNotificationToResponseDto(notification);
  }

  async sendBulkNotification(
    recipientIds: string[],
    notificationTypeName: string,
    titleTemplate: string,
    messageTemplate: string,
    options?: {
      senderId?: string;
      contentType?: string;
      objectId?: string;
      metadata?: Record<string, any>;
      actionUrl?: string;
      expiresAt?: Date;
    },
  ): Promise<{ message: string; sentCount: number }> {
    // Get notification type
    const notificationType = await this.prisma.notificationType.findUnique({
      where: { name: notificationTypeName },
    });

    if (!notificationType) {
      throw new NotFoundException('Notification type not found');
    }

    // Create notifications for all recipients
    const notifications = await Promise.all(
      recipientIds.map((recipientId) =>
        this.prisma.notification.create({
          data: {
            recipientId,
            senderId: options?.senderId,
            notificationTypeId: notificationType.id,
            title: titleTemplate,
            message: messageTemplate,
            contentType: options?.contentType,
            objectId: options?.objectId,
            metadata: options?.metadata || {},
            actionUrl: options?.actionUrl,
            expiresAt: options?.expiresAt,
          },
        }),
      ),
    );

    return {
      message: `Bulk notification sent to ${notifications.length} recipients`,
      sentCount: notifications.length,
    };
  }
}
