import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimal, IsUUID, IsOptional, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class EscrowOperationDto {
  @ApiProperty({
    description: 'Amount to place in escrow',
    example: 25.0,
    minimum: 0.01,
    maximum: 10000.0,
  })
  @Transform(({ value }) => parseFloat(value))
  @IsDecimal({ decimal_digits: '0,2' })
  @Min(0.01)
  @Max(10000.0)
  amount: number;

  @ApiProperty({
    description: 'Trade ID associated with escrow',
    example: 'uuid',
  })
  @IsUUID()
  tradeId: string;

  @ApiPropertyOptional({
    description: 'Description for the escrow operation',
    example: 'Escrow for trade #123',
  })
  @IsOptional()
  description?: string;
}
