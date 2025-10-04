import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsString,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    description: 'Trade ID',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  tradeId: number;

  @ApiProperty({
    description: 'Rating score',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    description: 'Review description',
    example: 'Great trade! Fast shipping and item in perfect condition.',
  })
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiProperty({
    description: 'Would trade again',
    example: true,
  })
  @IsBoolean()
  wouldTradeAgain: boolean;
}
