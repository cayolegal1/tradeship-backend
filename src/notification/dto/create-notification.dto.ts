import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsObject, IsUrl, IsDateString } from 'class-validator';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'Recipient user ID',
    example: 'uuid',
  })
  @IsUUID()
  recipientId: string;

  @ApiPropertyOptional({
    description: 'Sender user ID',
    example: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  senderId?: string;

  @ApiProperty({
    description: 'Notification type ID',
    example: 'uuid',
  })
  @IsUUID()
  notificationTypeId: string;

  @ApiProperty({
    description: 'Notification title',
    example: 'New Trade Request',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Notification message',
    example: 'You have received a new trade request',
  })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'Content type of related object',
    example: 'Trade',
  })
  @IsOptional()
  @IsString()
  contentType?: string;

  @ApiPropertyOptional({
    description: 'ID of related object',
    example: 'uuid',
  })
  @IsOptional()
  @IsString()
  objectId?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { tradeId: 'uuid', itemName: 'iPhone 13' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Action URL',
    example: 'https://app.tradeship.com/trades/uuid',
  })
  @IsOptional()
  @IsUrl()
  actionUrl?: string;

  @ApiPropertyOptional({
    description: 'Expiration date',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
