import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimal, IsUUID, IsOptional, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class WithdrawalRequestDto {
  @ApiProperty({
    description: 'Amount to withdraw',
    example: 50.00,
    minimum: 1.00,
    maximum: 10000.00,
  })
  @Transform(({ value }) => parseFloat(value))
  @IsDecimal({ decimal_digits: '0,2' })
  @Min(1.00)
  @Max(10000.00)
  amount: number;

  @ApiPropertyOptional({
    description: 'Bank account ID for withdrawal',
    example: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  bankAccountId?: string;

  @ApiPropertyOptional({
    description: 'Description for the withdrawal',
    example: 'Withdrawal to bank account',
  })
  @IsOptional()
  description?: string;
}
