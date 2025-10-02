import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsDecimal,
  IsOptional,
  IsString,
  IsDateString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTradeDto {
  @ApiProperty({
    description: 'User ID of the trader receiving the offer',
    example: 'uuid',
  })
  @IsUUID()
  traderReceivingId: string;

  @ApiProperty({
    description: 'Item ID being offered',
    example: 'uuid',
  })
  @IsUUID()
  itemOfferedId: string;

  @ApiPropertyOptional({
    description: 'Item ID being requested (optional for cash trades)',
    example: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  itemRequestedId?: string;

  @ApiPropertyOptional({
    description: 'Additional cash amount in trade',
    example: 50.0,
    minimum: 0,
  })
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsDecimal({ decimal_digits: '0,2' })
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
