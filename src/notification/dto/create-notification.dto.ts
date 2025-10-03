import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsObject,
  IsUrl,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateNotificationDto {
  @ApiProperty({
    description: 'Recipient user ID',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  recipientId: number;

  @ApiPropertyOptional({
    description: 'Sender user ID',
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  senderId?: number;

  @ApiProperty({
    description: 'Notification type ID',
    example: 5,
  })
  @Type(() => Number)
  @IsInt()
  notificationTypeId: number;

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
    example: '10',
  })
  @IsOptional()
  @Type(() => String)
  @IsString()
  objectId?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { tradeId: 10, itemName: 'iPhone 13' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Action URL',
    example: 'https://app.tradeship.com/trades/10',
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
