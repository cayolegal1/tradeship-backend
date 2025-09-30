import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsDecimal, IsOptional, IsArray, IsUUID, MinLength, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateItemDto {
  @ApiProperty({
    description: 'Item title',
    example: 'iPhone 13 Pro',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Item description',
    example: 'Excellent condition iPhone 13 Pro, 256GB, Space Gray',
  })
  @IsString()
  @MinLength(10)
  description: string;

  @ApiProperty({
    description: 'Estimated value in USD',
    example: 899.99,
    minimum: 0.01,
  })
  @Transform(({ value }) => parseFloat(value))
  @IsDecimal({ decimal_digits: '0,2' })
  @Min(0.01)
  estimatedValue: number;

  @ApiPropertyOptional({
    description: 'List of interest IDs',
    example: ['uuid1', 'uuid2'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  interests?: string[];

  @ApiPropertyOptional({
    description: 'Trade preferences',
    example: 'Looking for gaming laptops or high-end cameras',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradePreferences?: string;

  @ApiPropertyOptional({
    description: 'Minimum trade value',
    example: 500.00,
    minimum: 0.01,
  })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsDecimal({ decimal_digits: '0,2' })
  @Min(0.01)
  minimumTradeValue?: number;

  @ApiPropertyOptional({
    description: 'Whether accepts cash offers',
    example: true,
  })
  @IsOptional()
  acceptsCashOffers?: boolean;
}
