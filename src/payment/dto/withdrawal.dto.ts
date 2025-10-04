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

export class WithdrawalRequestDto {
  @ApiProperty({
    description: 'Amount to withdraw',
    example: 50.0,
    minimum: 1.0,
    maximum: 5000.0,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1.0)
  @Max(5000.0)
  amount: number;

  @ApiPropertyOptional({
    description: 'Bank account ID',
    example: 1,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  bankAccountId?: number;

  @ApiPropertyOptional({
    description: 'Description for the withdrawal',
    example: 'Transfer to bank',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
