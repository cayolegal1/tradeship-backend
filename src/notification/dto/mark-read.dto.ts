import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsArray, IsUUID, ArrayMaxSize } from 'class-validator';

export class MarkReadDto {
  @ApiProperty({
    description: 'Whether to mark as read or unread',
    example: true,
  })
  @IsBoolean()
  isRead: boolean;

  @ApiProperty({
    description: 'List of notification IDs to update',
    example: ['uuid1', 'uuid2'],
    maxItems: 100,
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(100)
  notificationIds: string[];
}
