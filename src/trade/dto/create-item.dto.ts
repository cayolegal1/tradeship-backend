import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsInt,
  MinLength,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const toNumber = (value: any): number => {
  if (value === null || value === undefined || value === '') {
    return value;
  }
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isNaN(parsed) ? value : parsed;
};

const toBoolean = (value: any): boolean | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return Boolean(value);
};

export class ShippingDimensionsDto {
  @ApiProperty({ description: 'Length in inches', example: 12.5 })
  @Transform(({ value }) => toNumber(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  length: number;

  @ApiProperty({ description: 'Width in inches', example: 8.75 })
  @Transform(({ value }) => toNumber(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  width: number;

  @ApiProperty({ description: 'Height in inches', example: 4.5 })
  @Transform(({ value }) => toNumber(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  height: number;
}

export class ShippingDetailsDto {
  @ApiProperty({ description: 'Package weight in lbs', example: 2.75 })
  @Transform(({ value }) => toNumber(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  weight: number;

  @ApiProperty({
    description: 'Package dimensions in inches',
    type: () => ShippingDimensionsDto,
  })
  @ValidateNested()
  @Type(() => ShippingDimensionsDto)
  dimensions: ShippingDimensionsDto;
}

export class CreateItemDto {
  @ApiProperty({
    description: 'Item name',
    example: 'iPhone 13 Pro',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiProperty({
    description: 'Item description',
    example: 'Excellent condition iPhone 13 Pro, 256GB, Space Gray',
  })
  @IsString()
  @MinLength(10)
  description: string;

  @ApiProperty({
    description: 'Estimated price in USD',
    example: 899.99,
    minimum: 0.01,
  })
  @Transform(({ value }) => toNumber(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  price: number;

  @ApiPropertyOptional({
    description: 'List of interest IDs',
    example: [1, 2],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  interests?: number[];

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
    example: 500.0,
    minimum: 0.01,
  })
  @IsOptional()
  @Transform(({ value }) => toNumber(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  minimumTradeValue?: number;

  @ApiPropertyOptional({
    description: 'Whether accepts cash offers',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  acceptsCashOffers?: boolean;

  @ApiPropertyOptional({
    description: 'Shipping details for the item',
    type: () => ShippingDetailsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingDetailsDto)
  shipping?: ShippingDetailsDto;
}
