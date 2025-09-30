import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsInt, IsString, IsBoolean, Min, Max, MinLength } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    description: 'Trade ID being reviewed',
    example: 'uuid',
  })
  @IsUUID()
  tradeId: string;

  @ApiProperty({
    description: 'Rating from 1-5 stars',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({
    description: 'Review description',
    example: 'Great trader, fast shipping, item as described',
  })
  @IsString()
  @MinLength(10)
  description: string;

  @ApiProperty({
    description: 'Would trade with this person again',
    example: true,
  })
  @IsBoolean()
  wouldTradeAgain: boolean;
}
