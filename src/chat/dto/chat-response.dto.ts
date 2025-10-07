import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class ChatUserDto {
  @ApiProperty({ example: 123 })
  @Expose()
  id: number;

  @ApiProperty({ example: 'john_doe' })
  @Expose()
  username: string;

  @ApiProperty({ example: 'John' })
  @Expose()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @Expose()
  lastName: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @Expose()
  avatar?: string;
}

export class ChatMessageResponseDto {
  @ApiProperty({ example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ example: 'TEXT' })
  @Expose()
  messageType: string;

  @ApiProperty({ example: 'Hi! I would love to trade my vintage guitar for your camera.' })
  @Expose()
  content: string;

  @ApiPropertyOptional({ example: 'https://example.com/file.pdf' })
  @Expose()
  file?: string;

  @ApiPropertyOptional({ example: 'document.pdf' })
  @Expose()
  fileName?: string;

  @ApiPropertyOptional({ example: 1024 })
  @Expose()
  fileSize?: number;

  @ApiPropertyOptional({ example: 'application/pdf' })
  @Expose()
  mimeType?: string;

  @ApiPropertyOptional({ example: 123 })
  @Expose()
  replyToId?: number;

  @ApiProperty({ example: false })
  @Expose()
  isEdited: boolean;

  @ApiProperty({ example: false })
  @Expose()
  isDeleted: boolean;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  @Expose()
  updatedAt: Date;

  @Type(() => ChatUserDto)
  @Expose()
  sender: ChatUserDto;
}

export class ChatConversationResponseDto {
  @ApiProperty({ example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ example: 'DIRECT' })
  @Expose()
  conversationType: string;

  @ApiPropertyOptional({ example: 'Trade Discussion' })
  @Expose()
  title?: string;

  @ApiPropertyOptional({ example: 'Discussion about trading vintage guitar for camera' })
  @Expose()
  description?: string;

  @ApiProperty({ example: true })
  @Expose()
  isActive: boolean;

  @ApiProperty({ example: false })
  @Expose()
  isArchived: boolean;

  @ApiProperty({ example: true })
  @Expose()
  isPrivate: boolean;

  @ApiPropertyOptional({ example: '2024-01-15T10:30:00.000Z' })
  @Expose()
  lastMessageAt?: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  @Expose()
  updatedAt: Date;

  @Type(() => ChatUserDto)
  @Expose()
  participants: ChatUserDto[];

  @Type(() => ChatMessageResponseDto)
  @Expose()
  lastMessage?: ChatMessageResponseDto;
}
