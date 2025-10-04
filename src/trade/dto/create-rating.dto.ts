import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsBoolean,
  Max,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateTradeRatingDto {
  @ApiProperty({
    description: 'Trade ID',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  tradeId: number;

  @ApiProperty({
    description: 'Communication rating',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  communicationRating: number;

  @ApiProperty({
    description: 'Item condition rating',
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  itemConditionRating: number;

  @ApiProperty({
    description: 'Shipping rating',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  shippingRating: number;

  @ApiProperty({
    description: 'Overall rating',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating: number;

  @ApiProperty({
    description: 'Feedback comments',
    example: 'Would happily trade again!',
  })
  @IsOptional()
  @MaxLength(500)
  feedback?: string;

  @ApiProperty({
    description: 'Would trade again',
    example: true,
  })
  @IsBoolean()
  wouldTradeAgain: boolean;
}
