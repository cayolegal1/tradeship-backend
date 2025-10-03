import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsArray, ArrayMaxSize, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class MarkReadDto {
  @ApiProperty({
    description: 'List of notification IDs to mark',
    example: [1, 2, 3],
    maxItems: 50,
  })
  @IsArray()
  @ArrayMaxSize(50)
  @Type(() => Number)
  @IsInt({ each: true })
  notificationIds: number[];

  @ApiProperty({
    description: 'Flag to mark as read or unread',
    example: true,
  })
  @IsBoolean()
  isRead: boolean;
}
