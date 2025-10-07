import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class TradeRequestUserDto {
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

export class TradeRequestItemDto {
  @ApiProperty({ example: 456 })
  @Expose()
  id: number;

  @ApiProperty({ example: 'Vintage Guitar' })
  @Expose()
  name: string;

  @ApiProperty({ example: 'A beautiful vintage guitar in excellent condition' })
  @Expose()
  description: string;

  @ApiProperty({ example: 299.99 })
  @Expose()
  price: number;

  @ApiProperty({ example: 'https://example.com/item-image.jpg' })
  @Expose()
  primaryImage?: string;

  @Type(() => TradeRequestUserDto)
  @Expose()
  owner: TradeRequestUserDto;
}

export class TradeRequestResponseDto {
  @ApiProperty({ example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ example: 'PENDING' })
  @Expose()
  status: string;

  @ApiPropertyOptional({ example: 50.00 })
  @Expose()
  cashAmount?: number;

  @ApiPropertyOptional({ example: 'I would love to trade my guitar for your camera!' })
  @Expose()
  message?: string;

  @ApiPropertyOptional({ example: '2024-02-01T00:00:00.000Z' })
  @Expose()
  expiresAt?: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  @Expose()
  updatedAt: Date;

  @ApiPropertyOptional({ example: '2024-01-15T11:00:00.000Z' })
  @Expose()
  respondedAt?: Date;

  @Type(() => TradeRequestUserDto)
  @Expose()
  requester: TradeRequestUserDto;

  @Type(() => TradeRequestUserDto)
  @Expose()
  recipient: TradeRequestUserDto;

  @Type(() => TradeRequestItemDto)
  @Expose()
  requestedItem: TradeRequestItemDto;

  @Type(() => TradeRequestItemDto)
  @Expose()
  proposedItem?: TradeRequestItemDto;

  @ApiPropertyOptional({ example: 789 })
  @Expose()
  tradeId?: number;
}
