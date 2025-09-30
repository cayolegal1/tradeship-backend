import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { NotificationResponseDto, NotificationStatsResponseDto } from './dto/notification-response.dto';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SuccessResponseDto } from '../common/dto/response.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new notification' })
  @ApiResponse({ status: 201, description: 'Notification created successfully', type: NotificationResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createNotification(@Body() createNotificationDto: CreateNotificationDto): Promise<NotificationResponseDto> {
    return this.notificationService.createNotification(createNotificationDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user notifications with pagination' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved successfully', type: PaginatedResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  async getUserNotifications(
    @CurrentUser() user: any,
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<NotificationResponseDto>> {
    return this.notificationService.getUserNotifications(user.id, paginationDto);
  }

  @Get('unread')
  @ApiOperation({ summary: 'Get unread notifications' })
  @ApiResponse({ status: 200, description: 'Unread notifications retrieved', type: [NotificationResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadNotifications(@CurrentUser() user: any): Promise<NotificationResponseDto[]> {
    return this.notificationService.getUnreadNotifications(user.id);
  }

  @Put('mark-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notifications as read/unread' })
  @ApiResponse({ status: 200, description: 'Notifications marked successfully', type: SuccessResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAsRead(
    @CurrentUser() user: any,
    @Body() markReadDto: MarkReadDto,
  ): Promise<SuccessResponseDto> {
    const result = await this.notificationService.markAsRead(user.id, markReadDto);
    return new SuccessResponseDto(result.message);
  }

  @Put('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read', type: SuccessResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllAsRead(@CurrentUser() user: any): Promise<SuccessResponseDto> {
    const result = await this.notificationService.markAllAsRead(user.id);
    return new SuccessResponseDto(result.message);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({ status: 200, description: 'Notification deleted successfully', type: SuccessResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async deleteNotification(
    @CurrentUser() user: any,
    @Param('id') notificationId: string,
  ): Promise<SuccessResponseDto> {
    const result = await this.notificationService.deleteNotification(user.id, notificationId);
    return new SuccessResponseDto(result.message);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get notification statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved', type: NotificationStatsResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getNotificationStats(@CurrentUser() user: any): Promise<NotificationStatsResponseDto> {
    return this.notificationService.getNotificationStats(user.id);
  }

  @Get('types')
  @ApiOperation({ summary: 'Get all notification types' })
  @ApiResponse({ status: 200, description: 'Notification types retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getNotificationTypes(): Promise<any[]> {
    return this.notificationService.getNotificationTypes();
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get user notification settings' })
  @ApiResponse({ status: 200, description: 'Settings retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserNotificationSettings(@CurrentUser() user: any): Promise<any[]> {
    return this.notificationService.getUserNotificationSettings(user.id);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update user notification settings' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully', type: SuccessResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateNotificationSettings(
    @CurrentUser() user: any,
    @Body() settings: Array<{
      notificationTypeId: string;
      emailEnabled: boolean;
      pushEnabled: boolean;
      inAppEnabled: boolean;
    }>,
  ): Promise<SuccessResponseDto> {
    const result = await this.notificationService.updateNotificationSettings(user.id, settings);
    return new SuccessResponseDto(result.message);
  }

  @Post('send')
  @ApiOperation({ summary: 'Send notification to user' })
  @ApiResponse({ status: 201, description: 'Notification sent successfully', type: NotificationResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification type not found' })
  async sendNotificationToUser(
    @CurrentUser() user: any,
    @Body() body: {
      recipientId: string;
      notificationTypeName: string;
      title: string;
      message: string;
      options?: {
        senderId?: string;
        contentType?: string;
        objectId?: string;
        metadata?: Record<string, any>;
        actionUrl?: string;
        expiresAt?: string;
      };
    },
  ): Promise<NotificationResponseDto> {
    const { recipientId, notificationTypeName, title, message, options } = body;
    
    return this.notificationService.sendNotificationToUser(
      recipientId,
      notificationTypeName,
      title,
      message,
      {
        ...options,
        expiresAt: options?.expiresAt ? new Date(options.expiresAt) : undefined,
      },
    );
  }

  @Post('send-bulk')
  @ApiOperation({ summary: 'Send bulk notification to multiple users' })
  @ApiResponse({ status: 201, description: 'Bulk notification sent successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification type not found' })
  async sendBulkNotification(
    @CurrentUser() user: any,
    @Body() body: {
      recipientIds: string[];
      notificationTypeName: string;
      titleTemplate: string;
      messageTemplate: string;
      options?: {
        senderId?: string;
        contentType?: string;
        objectId?: string;
        metadata?: Record<string, any>;
        actionUrl?: string;
        expiresAt?: string;
      };
    },
  ): Promise<SuccessResponseDto> {
    const { recipientIds, notificationTypeName, titleTemplate, messageTemplate, options } = body;
    
    const result = await this.notificationService.sendBulkNotification(
      recipientIds,
      notificationTypeName,
      titleTemplate,
      messageTemplate,
      {
        ...options,
        expiresAt: options?.expiresAt ? new Date(options.expiresAt) : undefined,
      },
    );

    return new SuccessResponseDto(result.message);
  }

  @Get('health')
  @ApiOperation({ summary: 'Notification service health check' })
  @ApiResponse({ status: 200, description: 'Notification service is healthy' })
  async healthCheck(): Promise<SuccessResponseDto> {
    return new SuccessResponseDto('Notification API is running');
  }
}
