import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsDateString, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTradeRequestDto {
  @ApiPropertyOptional({
    description: 'Cash amount to add to the trade',
    example: 50.00,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cashAmount?: number;

  @ApiPropertyOptional({
    description: 'Message to include with the trade request',
    example: 'I can add $25 to make this trade more fair. What do you think?',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({
    description: 'Expiration date for the trade request (ISO string)',
    example: '2024-02-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
