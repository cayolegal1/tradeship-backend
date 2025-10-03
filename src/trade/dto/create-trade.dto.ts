import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateTradeDto {
  @ApiProperty({
    description: 'User ID of the trader receiving the offer',
    example: 2,
  })
  @Type(() => Number)
  @IsInt()
  traderReceivingId: number;

  @ApiProperty({
    description: 'Item ID being offered',
    example: 10,
  })
  @Type(() => Number)
  @IsInt()
  itemOfferedId: number;

  @ApiPropertyOptional({
    description: 'Item ID being requested (optional for cash trades)',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  itemRequestedId?: number;

  @ApiPropertyOptional({
    description: 'Additional cash amount in trade',
    example: 50.0,
    minimum: 0,
  })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cashAmount?: number;

  @ApiPropertyOptional({
    description: 'Trade notes or special instructions',
    example: 'Please ship with insurance',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Estimated completion date',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  estimatedCompletion?: string;
}
