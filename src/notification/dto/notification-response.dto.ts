import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class NotificationResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  recipientId: number;

  @ApiPropertyOptional()
  @Expose()
  senderId?: number;

  @ApiProperty()
  @Expose()
  notificationTypeId: number;

  @ApiProperty()
  @Expose()
  title: string;

  @ApiProperty()
  @Expose()
  message: string;

  @ApiPropertyOptional()
  @Expose()
  contentType?: string;

  @ApiPropertyOptional()
  @Expose()
  objectId?: string;

  @ApiProperty()
  @Expose()
  isRead: boolean;

  @ApiPropertyOptional()
  @Expose()
  readAt?: Date;

  @ApiProperty()
  @Expose()
  emailSent: boolean;

  @ApiPropertyOptional()
  @Expose()
  emailSentAt?: Date;

  @ApiProperty()
  @Expose()
  pushSent: boolean;

  @ApiPropertyOptional()
  @Expose()
  pushSentAt?: Date;

  @ApiPropertyOptional()
  @Expose()
  metadata?: Record<string, any>;

  @ApiPropertyOptional()
  @Expose()
  actionUrl?: string;

  @ApiPropertyOptional()
  @Expose()
  expiresAt?: Date;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @ApiProperty()
  @Expose()
  isExpired: boolean;

  @ApiProperty()
  @Expose()
  timeSinceCreated: string;

  constructor(partial: Partial<NotificationResponseDto>) {
    Object.assign(this, partial);
    this.isExpired = this.expiresAt ? new Date() > this.expiresAt : false;
    this.timeSinceCreated = this.getTimeSinceCreated();
  }

  private getTimeSinceCreated(): string {
    const now = new Date();
    const diff = now.getTime() - this.createdAt.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }
}

export class NotificationTypeResponseDto {
  @ApiProperty()
  @Expose()
  id: number;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  displayName: string;

  @ApiPropertyOptional()
  @Expose()
  description?: string;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  requiresAction: boolean;

  @ApiProperty()
  @Expose()
  autoMarkRead: boolean;

  @ApiProperty()
  @Expose()
  defaultEmailEnabled: boolean;

  @ApiProperty()
  @Expose()
  defaultPushEnabled: boolean;

  @ApiProperty()
  @Expose()
  defaultInAppEnabled: boolean;

  @ApiProperty()
  @Expose()
  priority: string;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  constructor(partial: Partial<NotificationTypeResponseDto>) {
    Object.assign(this, partial);
  }
}

export class NotificationStatsResponseDto {
  @ApiProperty()
  @Expose()
  totalNotifications: number;

  @ApiProperty()
  @Expose()
  unreadNotifications: number;

  @ApiProperty()
  @Expose()
  readNotifications: number;

  @ApiProperty()
  @Expose()
  notificationsToday: number;

  @ApiProperty()
  @Expose()
  notificationsThisWeek: number;

  @ApiProperty()
  @Expose()
  notificationsThisMonth: number;

  @ApiProperty()
  @Expose()
  byType: Record<string, number>;

  @ApiProperty()
  @Expose()
  @Type(() => NotificationResponseDto)
  recentNotifications: NotificationResponseDto[];

  constructor(partial: Partial<NotificationStatsResponseDto>) {
    Object.assign(this, partial);
  }
}
