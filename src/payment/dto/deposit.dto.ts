import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimal, IsString, IsOptional, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class DepositRequestDto {
  @ApiProperty({
    description: 'Amount to deposit',
    example: 100.0,
    minimum: 1.0,
    maximum: 10000.0,
  })
  @Transform(({ value }) => parseFloat(value))
  @IsDecimal({ decimal_digits: '0,2' })
  @Min(1.0)
  @Max(10000.0)
  amount: number;

  @ApiProperty({
    description: 'Payment method ID',
    example: 'pm_1234567890',
  })
  @IsString()
  paymentMethodId: string;

  @ApiPropertyOptional({
    description: 'Description for the deposit',
    example: 'Wallet top-up',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
