import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
} from 'class-validator';

export class EscrowOperationDto {
  @ApiProperty({
    description: 'Amount to place in escrow',
    example: 25.0,
    minimum: 0.01,
    maximum: 10000.0,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10000.0)
  amount: number;

  @ApiProperty({
    description: 'Trade ID associated with escrow',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  tradeId: number;

  @ApiPropertyOptional({
    description: 'Description for the escrow operation',
    example: 'Escrow for trade #123',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
