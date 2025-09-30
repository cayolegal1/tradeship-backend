import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsInt,
  IsString,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  MinLength,
} from 'class-validator';

export class CreateTradeRatingDto {
  @ApiProperty({
    description: 'Trade ID being rated',
    example: 'uuid',
  })
  @IsUUID()
  tradeId: string;

  @ApiProperty({
    description: 'Communication rating (1-5)',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  communicationRating: number;

  @ApiProperty({
    description: 'Item condition rating (1-5)',
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  itemConditionRating: number;

  @ApiProperty({
    description: 'Shipping rating (1-5)',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  shippingRating: number;

  @ApiProperty({
    description: 'Overall rating (1-5)',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating: number;

  @ApiPropertyOptional({
    description: 'Additional feedback',
    example: 'Excellent communication and fast shipping',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  feedback?: string;

  @ApiProperty({
    description: 'Would trade with this person again',
    example: true,
  })
  @IsBoolean()
  wouldTradeAgain: boolean;
}
