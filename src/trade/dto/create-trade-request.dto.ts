import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsNumber, IsDateString, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTradeRequestDto {
  @ApiProperty({
    description: 'ID of the user who will receive the trade request',
    example: 123,
  })
  @IsInt()
  @Type(() => Number)
  recipientId: number;

  @ApiProperty({
    description: 'ID of the item being requested',
    example: 456,
  })
  @IsInt()
  @Type(() => Number)
  requestedItemId: number;

  @ApiPropertyOptional({
    description: 'ID of the item being offered in exchange (optional for cash-only offers)',
    example: 789,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  proposedItemId?: number;

  @ApiPropertyOptional({
    description: 'Cash amount to add to the trade (optional)',
    example: 50.00,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cashAmount?: number;

  @ApiPropertyOptional({
    description: 'Message to include with the trade request',
    example: 'I would love to trade my vintage guitar for your camera. Let me know what you think!',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({
    description: 'Expiration date for the trade request (ISO string)',
    example: '2024-02-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
